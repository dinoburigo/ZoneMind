from __future__ import annotations

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "zonemind.db"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS stores(
                store_code TEXT PRIMARY KEY,
                store_name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS articles(
                article_code TEXT PRIMARY KEY,
                description TEXT,
                image_url TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS article_barcodes(
                ean TEXT PRIMARY KEY,
                article_code TEXT NOT NULL,
                color_code TEXT,
                size_code TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(article_code) REFERENCES articles(article_code)
            );

            CREATE TABLE IF NOT EXISTS store_articles(
                store_code TEXT NOT NULL,
                article_code TEXT NOT NULL,
                active_flag INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(store_code, article_code),
                FOREIGN KEY(store_code) REFERENCES stores(store_code),
                FOREIGN KEY(article_code) REFERENCES articles(article_code)
            );

            CREATE TABLE IF NOT EXISTS layouts(
                layout_id TEXT PRIMARY KEY,
                store_code TEXT NOT NULL,
                layout_code TEXT NOT NULL,
                layout_json TEXT NOT NULL,
                active_flag INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(store_code) REFERENCES stores(store_code)
            );

            CREATE TABLE IF NOT EXISTS article_zone_assignments(
                store_code TEXT NOT NULL,
                layout_id TEXT NOT NULL,
                article_code TEXT NOT NULL,
                zone_id TEXT NOT NULL,
                zone_code TEXT NOT NULL,
                scanned_ean TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(store_code, layout_id, article_code),
                FOREIGN KEY(store_code) REFERENCES stores(store_code),
                FOREIGN KEY(layout_id) REFERENCES layouts(layout_id),
                FOREIGN KEY(article_code) REFERENCES articles(article_code)
            );

            CREATE TABLE IF NOT EXISTS import_runs(
                import_id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_code TEXT NOT NULL,
                file_name TEXT NOT NULL,
                rows_read INTEGER NOT NULL,
                rows_imported INTEGER NOT NULL,
                rows_rejected INTEGER NOT NULL,
                distinct_articles INTEGER NOT NULL,
                imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(store_code) REFERENCES stores(store_code)
            );

            CREATE INDEX IF NOT EXISTS idx_store_articles_store
                ON store_articles(store_code, active_flag);

            CREATE INDEX IF NOT EXISTS idx_assignments_layout_zone
                ON article_zone_assignments(layout_id, zone_id);

            CREATE INDEX IF NOT EXISTS idx_import_runs_store_date
                ON import_runs(store_code, imported_at DESC);
            """
        )

        # SQLite non consente ALTER TABLE ... ADD COLUMN con
        # DEFAULT CURRENT_TIMESTAMP su tabelle già esistenti.
        # Aggiungiamo quindi la colonna senza default e valorizziamo
        # i record preesistenti con un UPDATE separato.
        _ensure_timestamp_column(
            connection,
            "stores",
            "created_at",
        )
        _ensure_timestamp_column(
            connection,
            "articles",
            "updated_at",
        )
        _ensure_timestamp_column(
            connection,
            "article_barcodes",
            "updated_at",
        )
        _ensure_timestamp_column(
            connection,
            "store_articles",
            "updated_at",
        )


def _ensure_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
    definition: str,
) -> None:
    columns = {
        row["name"]
        for row in connection.execute(
            f"PRAGMA table_info({table_name})"
        ).fetchall()
    }

    if column_name not in columns:
        connection.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
        )


def _ensure_timestamp_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
) -> None:
    columns = {
        row["name"]
        for row in connection.execute(
            f"PRAGMA table_info({table_name})"
        ).fetchall()
    }

    if column_name not in columns:
        connection.execute(
            f"ALTER TABLE {table_name} "
            f"ADD COLUMN {column_name} TEXT"
        )

    connection.execute(
        f"UPDATE {table_name} "
        f"SET {column_name} = CURRENT_TIMESTAMP "
        f"WHERE {column_name} IS NULL OR {column_name} = ''"
    )
