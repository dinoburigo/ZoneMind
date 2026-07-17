import sqlite3
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / 'data'
DB_PATH = DATA_DIR / 'zonemind.db'

def get_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def initialize_database():
    with get_connection() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS stores(store_code TEXT PRIMARY KEY, store_name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS articles(article_code TEXT PRIMARY KEY, description TEXT, image_url TEXT);
        CREATE TABLE IF NOT EXISTS article_barcodes(ean TEXT PRIMARY KEY, article_code TEXT NOT NULL, color_code TEXT, size_code TEXT);
        CREATE TABLE IF NOT EXISTS store_articles(store_code TEXT NOT NULL, article_code TEXT NOT NULL, active_flag INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(store_code,article_code));
        CREATE TABLE IF NOT EXISTS layouts(layout_id TEXT PRIMARY KEY, store_code TEXT NOT NULL, layout_code TEXT NOT NULL, layout_json TEXT NOT NULL, active_flag INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS article_zone_assignments(store_code TEXT NOT NULL, layout_id TEXT NOT NULL, article_code TEXT NOT NULL, zone_id TEXT NOT NULL, zone_code TEXT NOT NULL, scanned_ean TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(store_code,layout_id,article_code));
        ''')
