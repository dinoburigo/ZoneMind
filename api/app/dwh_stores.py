from __future__ import annotations

import importlib
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query

from .database import get_connection

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

EXTENSION_VERSION = "1.1.0-dwh-sqlite-stores"
FETCH_SIZE = int(os.getenv("ZONEMIND_DWH_FETCH_SIZE", "5000"))
ORACLE_CLIENT_LIB_DIR = os.getenv("ZONEMIND_ORACLE_CLIENT_LIB_DIR", "").strip()
_ORACLE_CLIENT_INITIALIZED = False


def _stores_config() -> dict[str, str]:
    return {
        "user": os.getenv("ZONEMIND_DWH_USER", ""),
        "password": os.getenv("ZONEMIND_DWH_PASSWORD", ""),
        "dsn": os.getenv("ZONEMIND_DWH_DSN", ""),
        "view": os.getenv("ZONEMIND_DWH_STORES_VIEW", "V_ZONEMIND_STORES"),
    }


def _load_oracle_driver() -> tuple[str, Any]:
    global _ORACLE_CLIENT_INITIALIZED
    try:
        oracledb = importlib.import_module("oracledb")
        if ORACLE_CLIENT_LIB_DIR and not _ORACLE_CLIENT_INITIALIZED:
            oracledb.init_oracle_client(lib_dir=ORACLE_CLIENT_LIB_DIR)
            _ORACLE_CLIENT_INITIALIZED = True
        return "oracledb", oracledb
    except ModuleNotFoundError:
        pass
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Errore inizializzazione Oracle Client: {error}") from error
    try:
        return "cx_Oracle", importlib.import_module("cx_Oracle")
    except ModuleNotFoundError:
        pass
    raise HTTPException(status_code=500, detail="Driver Oracle non installato. Eseguire: pip install -r api\\requirements.txt")


def _connect_dwh():
    driver_name, driver = _load_oracle_driver()
    cfg = _stores_config()
    missing = [name for name in ("user", "password", "dsn") if not cfg[name]]
    if missing:
        raise HTTPException(
            status_code=500,
            detail="Variabili DWH mancanti: " + ", ".join(f"ZONEMIND_DWH_{name.upper()}" for name in missing),
        )
    if driver_name == "oracledb":
        return driver.connect(user=cfg["user"], password=cfg["password"], dsn=cfg["dsn"])
    return driver.connect(cfg["user"], cfg["password"], cfg["dsn"])


def _ensure_schema() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS zm_stores(
                id_store INTEGER PRIMARY KEY AUTOINCREMENT,
                cod_negozio TEXT NOT NULL UNIQUE,
                des_negozio TEXT,
                des_citta TEXT,
                des_nazione TEXT,
                dta_creazione TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                dta_update TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_zm_stores_city
                ON zm_stores(des_citta);

            CREATE INDEX IF NOT EXISTS idx_zm_stores_country
                ON zm_stores(des_nazione);

            CREATE TABLE IF NOT EXISTS dwh_store_sync_runs(
                sync_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_type TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                rows_read INTEGER NOT NULL DEFAULT 0,
                rows_rejected INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                message TEXT
            );
            """
        )


def _view_name() -> str:
    view = _stores_config()["view"].strip() or "V_ZONEMIND_STORES"
    allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.$")
    if any(ch not in allowed for ch in view):
        raise HTTPException(status_code=500, detail="Nome vista negozi DWH non valido")
    return view


def _dwh_sql(extra_where: str = "") -> str:
    return f"""
        SELECT
            COD_NEGOZIO,
            DES_NEGOZIO,
            DES_CITTA,
            DES_NAZIONE
        FROM {_view_name()}
        WHERE COD_NEGOZIO IS NOT NULL
          {extra_where}
    """


def _normalize_row(row: Any, columns: list[str]) -> dict[str, str | None]:
    if isinstance(row, dict):
        source = {str(key).upper(): value for key, value in row.items()}
    else:
        source = {columns[index].upper(): value for index, value in enumerate(row)}
    return {
        "COD_NEGOZIO": str(source.get("COD_NEGOZIO") or "").strip(),
        "DES_NEGOZIO": str(source.get("DES_NEGOZIO") or "").strip() or None,
        "DES_CITTA": str(source.get("DES_CITTA") or "").strip() or None,
        "DES_NAZIONE": str(source.get("DES_NAZIONE") or "").strip() or None,
    }


def _write_run(sync_type: str, started_at: str, rows_read: int, rows_rejected: int, status: str, message: str) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO dwh_store_sync_runs(sync_type, started_at, ended_at, rows_read, rows_rejected, status, message)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
            """,
            (sync_type, started_at, rows_read, rows_rejected, status, message[:1000]),
        )


def _reset_stores_for_full_reload() -> None:
    with get_connection() as connection:
        connection.execute("DELETE FROM zm_stores")


def _upsert_batch(rows: Iterable[dict[str, str | None]]) -> tuple[int, int]:
    rows_read = 0
    rows_rejected = 0
    with get_connection() as connection:
        for row in rows:
            try:
                store = row["COD_NEGOZIO"]
                name = row["DES_NEGOZIO"] or store
                city = row["DES_CITTA"]
                country = row["DES_NAZIONE"]
                if not store:
                    rows_rejected += 1
                    continue
                connection.execute(
                    """
                    INSERT INTO zm_stores(cod_negozio, des_negozio, des_citta, des_nazione, dta_update)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(cod_negozio) DO UPDATE SET
                        des_negozio = excluded.des_negozio,
                        des_citta = excluded.des_citta,
                        des_nazione = excluded.des_nazione,
                        dta_update = CURRENT_TIMESTAMP
                    """,
                    (store, name, city, country),
                )
                connection.execute(
                    """
                    INSERT INTO stores(store_code, store_name, city, country_code, active_flag, updated_at)
                    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(store_code) DO UPDATE SET
                        store_name = excluded.store_name,
                        city = excluded.city,
                        country_code = excluded.country_code,
                        active_flag = 1,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (store, name, city, country),
                )
                rows_read += 1
            except Exception:
                rows_rejected += 1
    return rows_read, rows_rejected


def _stores_payload() -> dict[str, Any]:
    _ensure_schema()
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS rows,
                COUNT(DISTINCT cod_negozio) AS stores,
                COUNT(DISTINCT des_citta) AS cities,
                COUNT(DISTINCT des_nazione) AS countries,
                MAX(dta_update) AS lastUpdate
            FROM zm_stores
            """
        ).fetchone()
        runs = connection.execute(
            """
            SELECT sync_id, sync_type, started_at, ended_at, rows_read, rows_rejected, status, message
            FROM dwh_store_sync_runs
            ORDER BY sync_id DESC
            LIMIT 10
            """
        ).fetchall()
    return {
        "rows": row["rows"],
        "stores": row["stores"],
        "cities": row["cities"],
        "countries": row["countries"],
        "lastUpdate": row["lastUpdate"],
        "runs": [dict(run) for run in runs],
    }


def _load_from_dwh(sync_type: str, extra_where: str = "", bind_values: dict[str, Any] | None = None) -> dict[str, Any]:
    _ensure_schema()
    started_at = datetime.now(timezone.utc).isoformat()
    rows_read_total = 0
    rows_rejected_total = 0
    if sync_type == "FULL":
        _reset_stores_for_full_reload()
    dwh = _connect_dwh()
    try:
        cursor = dwh.cursor()
        cursor.execute(_dwh_sql(extra_where), bind_values or {})
        columns = [column[0] for column in cursor.description]
        while True:
            batch = cursor.fetchmany(FETCH_SIZE)
            if not batch:
                break
            normalized = [_normalize_row(row, columns) for row in batch]
            rows_read, rows_rejected = _upsert_batch(normalized)
            rows_read_total += rows_read
            rows_rejected_total += rows_rejected
        cursor.close()
        _write_run(sync_type, started_at, rows_read_total, rows_rejected_total, "OK", f"{sync_type} completato da {_view_name()}")
        return {
            "status": "OK",
            "syncType": sync_type,
            "rowsRead": rows_read_total,
            "rowsRejected": rows_rejected_total,
            "stores": _stores_payload(),
        }
    except Exception as error:
        _write_run(sync_type, started_at, rows_read_total, rows_rejected_total, "ERROR", str(error))
        raise HTTPException(status_code=500, detail=f"Errore sync negozi DWH: {error}") from error
    finally:
        dwh.close()


def register_dwh_store_routes(app: FastAPI) -> None:
    @app.get("/api/admin/stores/dwh/status")
    def dwh_stores_status() -> dict[str, Any]:
        return {"status": "OK", "extensionVersion": EXTENSION_VERSION, "stores": _stores_payload()}

    @app.get("/api/admin/stores/dwh/health")
    def dwh_stores_health() -> dict[str, Any]:
        driver_name, _ = _load_oracle_driver()
        cfg = _stores_config()
        connection = _connect_dwh()
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT 1 FROM DUAL")
            cursor.fetchone()
            cursor.close()
        finally:
            connection.close()
        return {
            "status": "OK",
            "extensionVersion": EXTENSION_VERSION,
            "driver": driver_name,
            "dsn": cfg["dsn"],
            "view": cfg["view"],
        }

    @app.post("/api/admin/stores/dwh/full")
    def dwh_stores_full() -> dict[str, Any]:
        return _load_from_dwh("FULL")

    @app.post("/api/admin/stores/dwh/sync")
    def dwh_stores_sync() -> dict[str, Any]:
        return _load_from_dwh("SYNC")

    @app.post("/api/admin/stores/dwh/sync-store/{store}")
    def dwh_stores_sync_single(store: str) -> dict[str, Any]:
        return _load_from_dwh("SYNC_STORE", " AND COD_NEGOZIO = :store", {"store": store})
