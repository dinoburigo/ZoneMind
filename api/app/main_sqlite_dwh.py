from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

print("=== MAIN_SQLITE_DWH LOADED ===")

"""
ZoneMind SQLite DWH Catalog extension.

Adds DWH -> SQLite catalog loading endpoints to the existing ZoneMind FastAPI app.
The existing 1.0.0 app remains unchanged: this module imports api.app.main:app and
registers additional API routes.

Run with:
    python -m uvicorn api.app.main_sqlite_dwh:app --host 0.0.0.0 --port 8000 --reload

DWH expected view:
    V_ZONEMIND_ARTICLES

Expected columns:
    COD_STAGIONE, COD_NEGOZIO, COD_ARTICOLO, COD_COLORE, COD_TAGLIA, COD_EAN
"""

import importlib
import os

from datetime import datetime, timezone
from typing import Any, Iterable

from fastapi import HTTPException, Query

from .database import get_connection
from .main import app

EXTENSION_VERSION = "1.1.0-sqlite-dwh-catalog"
FETCH_SIZE = int(os.getenv("ZONEMIND_DWH_FETCH_SIZE", "5000"))


def _dwh_config() -> dict[str, str]:
    return {
        "user": os.getenv("ZONEMIND_DWH_USER", ""),
        "password": os.getenv("ZONEMIND_DWH_PASSWORD", ""),
        "dsn": os.getenv("ZONEMIND_DWH_DSN", ""),
        "view": os.getenv("ZONEMIND_DWH_ARTICLES_VIEW", "V_ZONEMIND_ARTICLES"),
    }


def _load_oracle_driver() -> tuple[str, Any]:
    try:
        return "oracledb", importlib.import_module("oracledb")
    except ModuleNotFoundError:
        pass
    try:
        return "cx_Oracle", importlib.import_module("cx_Oracle")
    except ModuleNotFoundError:
        pass
    raise HTTPException(
        status_code=500,
        detail=(
            "Driver Oracle non installato. Installare 'oracledb' oppure 'cx_Oracle' "
            "nella virtual environment usata da ZoneMind."
        ),
    )


def _connect_dwh():
    driver_name, driver = _load_oracle_driver()
    cfg = _dwh_config()
    missing = [name for name in ("user", "password", "dsn") if not cfg[name]]
    if missing:
        raise HTTPException(
            status_code=500,
            detail="Variabili DWH mancanti: " + ", ".join(f"ZONEMIND_DWH_{name.upper()}" for name in missing),
        )
    if driver_name == "oracledb":
        return driver.connect(user=cfg["user"], password=cfg["password"], dsn=cfg["dsn"])
    return driver.connect(cfg["user"], cfg["password"], cfg["dsn"])


def _ensure_sqlite_catalog_schema() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS zm_articles(
                id_article INTEGER PRIMARY KEY AUTOINCREMENT,
                cod_stagione TEXT NOT NULL,
                cod_negozio TEXT NOT NULL,
                cod_articolo TEXT NOT NULL,
                cod_ean TEXT NOT NULL,
                cod_colore TEXT,
                cod_taglia TEXT,
                dta_creazione TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                dta_update TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(cod_stagione, cod_negozio, cod_ean)
            );

            CREATE INDEX IF NOT EXISTS idx_zm_articles_store
                ON zm_articles(cod_negozio, cod_stagione);

            CREATE INDEX IF NOT EXISTS idx_zm_articles_article
                ON zm_articles(cod_articolo);

            CREATE INDEX IF NOT EXISTS idx_zm_articles_ean
                ON zm_articles(cod_ean);

            CREATE TABLE IF NOT EXISTS dwh_catalog_sync_runs(
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


def _dwh_sql(where_clause: str = "") -> str:
    view = _dwh_config()["view"]
    return f"""
        SELECT
            COD_STAGIONE,
            COD_NEGOZIO,
            COD_ARTICOLO,
            COD_COLORE,
            COD_TAGLIA,
            COD_EAN
        FROM {view}
        WHERE COD_STAGIONE IS NOT NULL
          AND COD_NEGOZIO IS NOT NULL
          AND COD_ARTICOLO IS NOT NULL
          AND COD_EAN IS NOT NULL
          {where_clause}
    """


def _normalize_row(row: Any, columns: list[str] | None = None) -> dict[str, str | None]:
    if isinstance(row, dict):
        source = {str(k).upper(): v for k, v in row.items()}
    else:
        source = {columns[index].upper(): value for index, value in enumerate(row)}
    return {
        "COD_STAGIONE": str(source.get("COD_STAGIONE") or "").strip(),
        "COD_NEGOZIO": str(source.get("COD_NEGOZIO") or "").strip(),
        "COD_ARTICOLO": str(source.get("COD_ARTICOLO") or "").strip(),
        "COD_COLORE": str(source.get("COD_COLORE") or "").strip() or None,
        "COD_TAGLIA": str(source.get("COD_TAGLIA") or "").strip() or None,
        "COD_EAN": str(source.get("COD_EAN") or "").strip(),
    }


def _write_run(sync_type: str, started_at: str, rows_read: int, rows_rejected: int, status: str, message: str) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO dwh_catalog_sync_runs(sync_type, started_at, ended_at, rows_read, rows_rejected, status, message)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
            """,
            (sync_type, started_at, rows_read, rows_rejected, status, message[:1000]),
        )


def _reset_catalog_for_full_reload() -> None:
    """Full reload is intended for initial load/rebuild.

    It does not touch layouts or assignments. Existing mapped articles are kept in
    the articles table, but the operative catalog tables are rebuilt.
    """
    with get_connection() as connection:
        connection.execute("DELETE FROM zm_articles")
        connection.execute("DELETE FROM store_articles")
        connection.execute("DELETE FROM article_barcodes")
        connection.execute(
            """
            DELETE FROM articles
            WHERE article_code NOT IN (
                SELECT DISTINCT article_code FROM article_zone_assignments
            )
            """
        )


def _upsert_batch(rows: Iterable[dict[str, str | None]]) -> tuple[int, int]:
    read = 0
    rejected = 0
    with get_connection() as connection:
        for row in rows:
            try:
                season = row["COD_STAGIONE"]
                store = row["COD_NEGOZIO"]
                article = row["COD_ARTICOLO"]
                ean = row["COD_EAN"]
                color = row["COD_COLORE"]
                size = row["COD_TAGLIA"]
                if not season or not store or not article or not ean:
                    rejected += 1
                    continue
                connection.execute(
                    """
                    INSERT INTO stores(store_code, store_name, active_flag, updated_at)
                    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(store_code) DO UPDATE SET
                        active_flag = 1,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (store, store),
                )
                connection.execute(
                    """
                    INSERT INTO articles(article_code, description, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(article_code) DO UPDATE SET
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (article, article),
                )
                connection.execute(
                    """
                    INSERT INTO article_barcodes(ean, article_code, color_code, size_code, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(ean) DO UPDATE SET
                        article_code = excluded.article_code,
                        color_code = excluded.color_code,
                        size_code = excluded.size_code,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (ean, article, color, size),
                )
                connection.execute(
                    """
                    INSERT INTO store_articles(store_code, article_code, active_flag, updated_at)
                    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(store_code, article_code) DO UPDATE SET
                        active_flag = 1,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (store, article),
                )
                connection.execute(
                    """
                    INSERT INTO zm_articles(cod_stagione, cod_negozio, cod_articolo, cod_ean, cod_colore, cod_taglia, dta_update)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(cod_stagione, cod_negozio, cod_ean) DO UPDATE SET
                        cod_articolo = excluded.cod_articolo,
                        cod_colore = excluded.cod_colore,
                        cod_taglia = excluded.cod_taglia,
                        dta_update = CURRENT_TIMESTAMP
                    """,
                    (season, store, article, ean, color, size),
                )
                read += 1
            except Exception:
                rejected += 1
    return read, rejected


def _load_from_dwh(sync_type: str, where_clause: str = "") -> dict[str, Any]:
    _ensure_sqlite_catalog_schema()
    started_at = datetime.now(timezone.utc).isoformat()
    rows_read = 0
    rows_rejected = 0
    if sync_type == "FULL":
        _reset_catalog_for_full_reload()
    dwh = _connect_dwh()
    try:
        cursor = dwh.cursor()
        cursor.execute(_dwh_sql(where_clause))
        columns = [col[0] for col in cursor.description]
        while True:
            batch = cursor.fetchmany(FETCH_SIZE)
            if not batch:
                break
            normalized = [_normalize_row(row, columns) for row in batch]
            read, rejected = _upsert_batch(normalized)
            rows_read += read
            rows_rejected += rejected
        cursor.close()
        _write_run(sync_type, started_at, rows_read, rows_rejected, "OK", f"{sync_type} completato da V_ZONEMIND_ARTICLES")
        return {"status": "OK", "syncType": sync_type, "rowsRead": rows_read, "rowsRejected": rows_rejected, "catalog": _catalog_status_payload()}
    except Exception as error:
        _write_run(sync_type, started_at, rows_read, rows_rejected, "ERROR", str(error))
        raise HTTPException(status_code=500, detail=f"Errore sync catalogo DWH: {error}") from error
    finally:
        dwh.close()


def _catalog_status_payload() -> dict[str, Any]:
    _ensure_sqlite_catalog_schema()
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS rows,
                COUNT(DISTINCT cod_stagione) AS seasons,
                COUNT(DISTINCT cod_negozio) AS stores,
                COUNT(DISTINCT cod_articolo) AS articles,
                COUNT(DISTINCT cod_ean) AS eans,
                MAX(dta_update) AS lastUpdate
            FROM zm_articles
            """
        ).fetchone()
        logs = connection.execute(
            """
            SELECT sync_id, sync_type, started_at, ended_at, rows_read, rows_rejected, status, message
            FROM dwh_catalog_sync_runs
            ORDER BY sync_id DESC
            LIMIT 10
            """
        ).fetchall()
    return {
        "rows": row["rows"],
        "seasons": row["seasons"],
        "stores": row["stores"],
        "articles": row["articles"],
        "eans": row["eans"],
        "lastUpdate": row["lastUpdate"],
        "runs": [dict(log) for log in logs],
    }


@app.get("/api/admin/catalog/sqlite-dwh/status")
def sqlite_dwh_catalog_status() -> dict[str, Any]:
    return {"status": "OK", "extensionVersion": EXTENSION_VERSION, "catalog": _catalog_status_payload()}


@app.get("/api/admin/catalog/sqlite-dwh/health")
def sqlite_dwh_catalog_health() -> dict[str, Any]:
    driver_name, _ = _load_oracle_driver()
    cfg = _dwh_config()
    connection = _connect_dwh()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT 1 FROM DUAL")
        cursor.fetchone()
        cursor.close()
    finally:
        connection.close()
    return {"status": "OK", "extensionVersion": EXTENSION_VERSION, "driver": driver_name, "dsn": cfg["dsn"], "view": cfg["view"]}


@app.post("/api/admin/catalog/sqlite-dwh/full")
def sqlite_dwh_catalog_full() -> dict[str, Any]:
    return _load_from_dwh("FULL")


@app.post("/api/admin/catalog/sqlite-dwh/sync")
def sqlite_dwh_catalog_sync() -> dict[str, Any]:
    return _load_from_dwh("SYNC")


@app.post("/api/admin/catalog/sqlite-dwh/sync-store/{store}")
def sqlite_dwh_catalog_sync_store(store: str, season: str | None = Query(default=None)) -> dict[str, Any]:
    where = " AND COD_NEGOZIO = :store"
    # Oracle bind variables are not used here because the source view name is already dynamic
    # and this endpoint is operational/admin-only. Keep values strictly alphanumeric-ish.
    safe_store = "".join(ch for ch in store if ch.isalnum() or ch in "_- ").strip()
    if not safe_store:
        raise HTTPException(status_code=400, detail="Codice negozio non valido")
    where = f" AND COD_NEGOZIO = '{safe_store}'"
    if season:
        safe_season = "".join(ch for ch in season if ch.isalnum() or ch in "_- ").strip()
        where += f" AND COD_STAGIONE = '{safe_season}'"
    return _load_from_dwh("SYNC_STORE", where)
    
    
@app.get("/dino")
def dino():
    return {
        "status": "OK",
        "version": "sqlite-dwh"
    }
