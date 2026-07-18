from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .database import get_connection, initialize_database

BASE_DIR = Path(__file__).resolve().parents[2]
PUBLIC_DIR = BASE_DIR / "public"

app = FastAPI(title="ZoneMind API", version="0.8.5")


class StorePayload(BaseModel):
    storeCode: str = Field(min_length=1, max_length=30)
    storeName: str = Field(min_length=1, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    countryCode: str | None = Field(default=None, max_length=3)
    active: bool = True


class Assignment(BaseModel):
    articleCode: str = Field(min_length=1)
    scannedEan: str | None = None
    storeCode: str = Field(min_length=1)
    layoutId: str = Field(min_length=1)
    zoneId: str = Field(min_length=1)
    zoneCode: str = Field(min_length=1)
    updatedAt: str = Field(min_length=1)


@app.on_event("startup")
def startup() -> None:
    initialize_database()
    seed_layout_from_file()


def seed_layout_from_file() -> None:
    path = PUBLIC_DIR / "data" / "layout-current.json"
    if not path.exists():
        return

    try:
        layout = json.loads(path.read_text(encoding="utf-8"))
        save_layout(layout)
    except Exception as error:
        print(f"Layout iniziale non caricato: {error}")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.8.5"}


@app.get("/api/admin/stores")
def list_stores(includeInactive: bool = True) -> list[dict[str, Any]]:
    where = "" if includeInactive else "WHERE s.active_flag = 1"
    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT
                s.store_code, s.store_name, s.city, s.country_code,
                s.active_flag, s.created_at, s.updated_at,
                COUNT(DISTINCT CASE WHEN sa.active_flag = 1 THEN sa.article_code END) AS article_count,
                COUNT(DISTINCT aza.article_code) AS assignment_count
            FROM stores s
            LEFT JOIN store_articles sa ON sa.store_code = s.store_code
            LEFT JOIN article_zone_assignments aza ON aza.store_code = s.store_code
            {where}
            GROUP BY s.store_code, s.store_name, s.city, s.country_code,
                     s.active_flag, s.created_at, s.updated_at
            ORDER BY s.active_flag DESC, s.store_code
            """
        ).fetchall()
    return [{
        "storeCode": r["store_code"], "storeName": r["store_name"],
        "city": r["city"], "countryCode": r["country_code"],
        "active": bool(r["active_flag"]), "createdAt": r["created_at"],
        "updatedAt": r["updated_at"], "articleCount": r["article_count"],
        "assignmentCount": r["assignment_count"],
    } for r in rows]


@app.post("/api/admin/stores", status_code=201)
def create_store(payload: StorePayload) -> dict[str, Any]:
    code = payload.storeCode.strip().upper()
    with get_connection() as connection:
        exists = connection.execute("SELECT 1 FROM stores WHERE store_code = ?", (code,)).fetchone()
        if exists:
            raise HTTPException(409, "Codice negozio già esistente")
        connection.execute(
            """INSERT INTO stores(store_code, store_name, city, country_code, active_flag, updated_at)
               VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (code, payload.storeName.strip(), (payload.city or "").strip() or None,
             (payload.countryCode or "").strip().upper() or None, 1 if payload.active else 0),
        )
    return {"storeCode": code, "status": "CREATED"}


@app.put("/api/admin/stores/{store}")
def update_store(store: str, payload: StorePayload) -> dict[str, Any]:
    code = store.strip().upper()
    if payload.storeCode.strip().upper() != code:
        raise HTTPException(400, "Il codice negozio non può essere modificato")
    with get_connection() as connection:
        cursor = connection.execute(
            """UPDATE stores SET store_name=?, city=?, country_code=?, active_flag=?, updated_at=CURRENT_TIMESTAMP
               WHERE store_code=?""",
            (payload.storeName.strip(), (payload.city or "").strip() or None,
             (payload.countryCode or "").strip().upper() or None, 1 if payload.active else 0, code),
        )
        if cursor.rowcount == 0:
            raise HTTPException(404, "Negozio non trovato")
    return {"storeCode": code, "status": "UPDATED"}


@app.get("/api/admin/stores/{store}/summary")
def store_summary(store: str) -> dict[str, Any]:
    with get_connection() as connection:
        store_row = connection.execute(
            "SELECT store_code, store_name FROM stores WHERE store_code = ?",
            (store,),
        ).fetchone()

        if store_row is None:
            raise HTTPException(404, "Negozio non trovato")

        catalog = connection.execute(
            """
            SELECT
                COUNT(DISTINCT sa.article_code) AS article_count,
                COUNT(DISTINCT b.ean) AS barcode_count
            FROM store_articles sa
            LEFT JOIN article_barcodes b
              ON b.article_code = sa.article_code
            WHERE sa.store_code = ?
              AND sa.active_flag = 1
            """,
            (store,),
        ).fetchone()

        layout_row = connection.execute(
            """
            SELECT layout_id, layout_code, layout_json, updated_at
            FROM layouts
            WHERE store_code = ? AND active_flag = 1
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (store,),
        ).fetchone()

        assignment_count = connection.execute(
            """
            SELECT COUNT(DISTINCT article_code) AS assignment_count
            FROM article_zone_assignments
            WHERE store_code = ?
            """,
            (store,),
        ).fetchone()["assignment_count"]

        last_import = connection.execute(
            """
            SELECT *
            FROM import_runs
            WHERE store_code = ?
            ORDER BY imported_at DESC, import_id DESC
            LIMIT 1
            """,
            (store,),
        ).fetchone()

    layout_info = None
    if layout_row:
        layout_json = json.loads(layout_row["layout_json"])
        layout_info = {
            "layoutId": layout_row["layout_id"],
            "layoutCode": layout_row["layout_code"],
            "zoneCount": len(layout_json.get("zones", [])),
            "updatedAt": layout_row["updated_at"],
        }

    return {
        "storeCode": store_row["store_code"],
        "storeName": store_row["store_name"],
        "catalog": {
            "articleCount": catalog["article_count"],
            "barcodeCount": catalog["barcode_count"],
        },
        "layout": layout_info,
        "assignmentCount": assignment_count,
        "lastImport": dict(last_import) if last_import else None,
    }


@app.post("/api/import/articles")
async def import_articles(
    file: UploadFile = File(...),
    replaceStoreCatalog: bool = True,
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Caricare un file CSV")

    try:
        text = (await file.read()).decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(400, "Il CSV deve essere UTF-8") from error

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    required = {"storeCode", "ean", "articleCode", "description"}

    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        raise HTTPException(400, "Colonne CSV non valide")

    if not rows:
        raise HTTPException(400, "Il CSV non contiene dati")

    stores = {
        (row.get("storeCode") or "").strip()
        for row in rows
        if (row.get("storeCode") or "").strip()
    }

    if len(stores) != 1:
        raise HTTPException(400, "Il CSV deve contenere un solo negozio")

    store = next(iter(stores))
    imported = 0
    articles: set[str] = set()
    errors: list[str] = []

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO stores(store_code, store_name)
            VALUES (?, ?)
            ON CONFLICT(store_code) DO UPDATE SET
                store_name = excluded.store_name
            """,
            (store, store),
        )

        if replaceStoreCatalog:
            connection.execute(
                "UPDATE store_articles SET active_flag = 0 WHERE store_code = ?",
                (store,),
            )

        for line_number, row in enumerate(rows, start=2):
            try:
                ean = (row.get("ean") or "").strip()
                article = (row.get("articleCode") or "").strip()
                description = (row.get("description") or "").strip()

                if not ean or not article:
                    raise ValueError("EAN o articolo mancante")

                connection.execute(
                    """
                    INSERT INTO articles(
                        article_code, description, image_url, updated_at
                    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(article_code) DO UPDATE SET
                        description = excluded.description,
                        image_url = excluded.image_url,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        article,
                        description,
                        (row.get("imageUrl") or "").strip() or None,
                    ),
                )

                connection.execute(
                    """
                    INSERT INTO article_barcodes(
                        ean, article_code, color_code, size_code, updated_at
                    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(ean) DO UPDATE SET
                        article_code = excluded.article_code,
                        color_code = excluded.color_code,
                        size_code = excluded.size_code,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        ean,
                        article,
                        (row.get("colorCode") or "").strip() or None,
                        (row.get("sizeCode") or "").strip() or None,
                    ),
                )

                connection.execute(
                    """
                    INSERT INTO store_articles(
                        store_code, article_code, active_flag, updated_at
                    ) VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(store_code, article_code) DO UPDATE SET
                        active_flag = 1,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (store, article),
                )

                imported += 1
                articles.add(article)
            except Exception as error:
                errors.append(f"Riga {line_number}: {error}")

        connection.execute(
            """
            INSERT INTO import_runs(
                store_code,
                file_name,
                rows_read,
                rows_imported,
                rows_rejected,
                distinct_articles
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                store,
                file.filename,
                len(rows),
                imported,
                len(errors),
                len(articles),
            ),
        )

    return {
        "storeCode": store,
        "rowsRead": len(rows),
        "rowsImported": imported,
        "rowsRejected": len(errors),
        "distinctArticles": len(articles),
        "errors": errors[:100],
    }


@app.post("/api/admin/layouts")
async def upload_layout(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Caricare un layout JSON")

    try:
        layout = json.loads((await file.read()).decode("utf-8-sig"))
        validate_layout(layout)
        save_layout(layout)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HTTPException(400, "JSON non valido") from error
    except ValueError as error:
        raise HTTPException(400, str(error)) from error

    return {
        "storeCode": layout["storeCode"],
        "layoutId": layout["layoutId"],
        "layoutCode": layout.get("layoutCode", "LAYOUT001"),
        "zoneCount": len(layout["zones"]),
        "status": "ACTIVE",
    }


def validate_layout(layout: dict[str, Any]) -> None:
    required = {"storeCode", "layoutId", "zones", "image"}
    missing = required.difference(layout)

    if missing:
        raise ValueError(
            "Campi layout mancanti: " + ", ".join(sorted(missing))
        )

    if not isinstance(layout["zones"], list):
        raise ValueError("Il campo zones deve essere un elenco")


def save_layout(layout: dict[str, Any]) -> None:
    validate_layout(layout)
    store_code = layout["storeCode"]
    layout_id = layout["layoutId"]
    layout_code = layout.get("layoutCode", "LAYOUT001")

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO stores(store_code, store_name)
            VALUES (?, ?)
            ON CONFLICT(store_code) DO NOTHING
            """,
            (store_code, store_code),
        )

        connection.execute(
            "UPDATE layouts SET active_flag = 0 WHERE store_code = ?",
            (store_code,),
        )

        connection.execute(
            """
            INSERT INTO layouts(
                layout_id,
                store_code,
                layout_code,
                layout_json,
                active_flag,
                updated_at
            ) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(layout_id) DO UPDATE SET
                layout_code = excluded.layout_code,
                layout_json = excluded.layout_json,
                active_flag = 1,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                layout_id,
                store_code,
                layout_code,
                json.dumps(layout, ensure_ascii=False),
            ),
        )


@app.get("/api/admin/stores/{store}/layouts")
def admin_layouts(store: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT l.layout_id, l.layout_code, l.layout_json, l.active_flag,
                   l.created_at, l.updated_at,
                   COUNT(DISTINCT aza.article_code) AS assignment_count
            FROM layouts l
            LEFT JOIN article_zone_assignments aza
              ON aza.store_code=l.store_code AND aza.layout_id=l.layout_id
            WHERE l.store_code=?
            GROUP BY l.layout_id, l.layout_code, l.layout_json, l.active_flag,
                     l.created_at, l.updated_at
            ORDER BY l.active_flag DESC, l.updated_at DESC
            """, (store,)
        ).fetchall()
    result = []
    for row in rows:
        data = json.loads(row["layout_json"])
        result.append({
            "layoutId": row["layout_id"], "layoutCode": row["layout_code"],
            "active": bool(row["active_flag"]), "zoneCount": len(data.get("zones", [])),
            "assignmentCount": row["assignment_count"],
            "imageName": (data.get("image") or {}).get("name") if isinstance(data.get("image"), dict) else None,
            "createdAt": row["created_at"], "updatedAt": row["updated_at"]
        })
    return result


@app.get("/api/admin/stores/{store}/layouts/{layout_id}")
def admin_layout_detail(store: str, layout_id: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT layout_json, active_flag, updated_at FROM layouts WHERE store_code=? AND layout_id=?",
            (store, layout_id)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Layout non trovato")
    data = json.loads(row["layout_json"])
    return {"active": bool(row["active_flag"]), "updatedAt": row["updated_at"], "layout": data}


@app.get("/api/admin/stores/{store}/layouts/{layout_id}/download")
def download_layout(store: str, layout_id: str) -> JSONResponse:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT layout_code, layout_json FROM layouts WHERE store_code=? AND layout_id=?",
            (store, layout_id)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Layout non trovato")
    filename = f"{store}_{row['layout_code'] or layout_id}.json"
    return JSONResponse(
        content=json.loads(row["layout_json"]),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.post("/api/admin/stores/{store}/layouts/{layout_id}/activate")
def activate_layout(store: str, layout_id: str) -> dict[str, str]:
    with get_connection() as connection:
        exists = connection.execute(
            "SELECT 1 FROM layouts WHERE store_code=? AND layout_id=?", (store, layout_id)
        ).fetchone()
        if exists is None:
            raise HTTPException(404, "Layout non trovato")
        connection.execute("UPDATE layouts SET active_flag=0 WHERE store_code=?", (store,))
        connection.execute(
            "UPDATE layouts SET active_flag=1, updated_at=CURRENT_TIMESTAMP WHERE store_code=? AND layout_id=?",
            (store, layout_id)
        )
    return {"layoutId": layout_id, "status": "ACTIVE"}


@app.get("/api/admin/stores/{store}/articles")
def admin_articles(
    store: str,
    search: str = "",
    mappingStatus: str = Query("all", pattern="^(all|mapped|unmapped)$"),
    sortBy: str = Query("articleCode", pattern="^(articleCode|description|barcodeCount|zoneCode)$"),
    sortDir: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    pattern = f"%{search.strip()}%"
    status_sql = {
        "all": "",
        "mapped": "AND aza.article_code IS NOT NULL",
        "unmapped": "AND aza.article_code IS NULL",
    }[mappingStatus]
    order_column = {
        "articleCode": "a.article_code",
        "description": "a.description",
        "barcodeCount": "barcode_count",
        "zoneCode": "zone_code",
    }[sortBy]
    direction = "DESC" if sortDir == "desc" else "ASC"

    with get_connection() as connection:
        total = connection.execute(
            f"""
            SELECT COUNT(DISTINCT sa.article_code)
            FROM store_articles sa
            JOIN articles a ON a.article_code = sa.article_code
            LEFT JOIN article_zone_assignments aza
              ON aza.store_code = sa.store_code AND aza.article_code = sa.article_code
            WHERE sa.store_code = ?
              AND sa.active_flag = 1
              AND (? = '' OR a.article_code LIKE ? OR a.description LIKE ?
                   OR EXISTS (SELECT 1 FROM article_barcodes bx WHERE bx.article_code=a.article_code AND bx.ean LIKE ?))
              {status_sql}
            """,
            (store, search.strip(), pattern, pattern, pattern),
        ).fetchone()[0]

        rows = connection.execute(
            f"""
            SELECT
                a.article_code, a.description, a.image_url,
                COUNT(DISTINCT b.ean) AS barcode_count,
                MAX(aza.zone_code) AS zone_code,
                MAX(aza.updated_at) AS assignment_updated_at
            FROM store_articles sa
            JOIN articles a ON a.article_code = sa.article_code
            LEFT JOIN article_barcodes b ON b.article_code = a.article_code
            LEFT JOIN article_zone_assignments aza
              ON aza.store_code = sa.store_code AND aza.article_code = sa.article_code
            WHERE sa.store_code = ?
              AND sa.active_flag = 1
              AND (? = '' OR a.article_code LIKE ? OR a.description LIKE ?
                   OR EXISTS (SELECT 1 FROM article_barcodes bx WHERE bx.article_code=a.article_code AND bx.ean LIKE ?))
              {status_sql}
            GROUP BY a.article_code, a.description, a.image_url
            ORDER BY {order_column} {direction}, a.article_code ASC
            LIMIT ? OFFSET ?
            """,
            (store, search.strip(), pattern, pattern, pattern, limit, offset),
        ).fetchall()

    return {
        "total": total, "limit": limit, "offset": offset,
        "items": [{
            "articleCode": row["article_code"], "description": row["description"],
            "imageUrl": row["image_url"], "barcodeCount": row["barcode_count"],
            "zoneCode": row["zone_code"],
            "mappingStatus": "mapped" if row["zone_code"] else "unmapped",
            "assignmentUpdatedAt": row["assignment_updated_at"],
        } for row in rows],
    }


@app.get("/api/admin/stores/{store}/articles/{article}")
def admin_article_detail(store: str, article: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            """SELECT a.article_code, a.description, a.image_url, sa.active_flag,
                      aza.zone_code, aza.zone_id, aza.updated_at AS assignment_updated_at
               FROM store_articles sa
               JOIN articles a ON a.article_code=sa.article_code
               LEFT JOIN article_zone_assignments aza
                 ON aza.store_code=sa.store_code AND aza.article_code=sa.article_code
               WHERE sa.store_code=? AND sa.article_code=?""",
            (store, article),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Articolo non trovato nel negozio")
        barcodes = connection.execute(
            """SELECT ean, color_code, size_code FROM article_barcodes
               WHERE article_code=? ORDER BY ean""", (article,)
        ).fetchall()
    return {
        "storeCode": store, "articleCode": row["article_code"],
        "description": row["description"], "imageUrl": row["image_url"],
        "active": bool(row["active_flag"]), "zoneCode": row["zone_code"],
        "zoneId": row["zone_id"], "assignmentUpdatedAt": row["assignment_updated_at"],
        "barcodes": [{"ean": b["ean"], "colorCode": b["color_code"], "sizeCode": b["size_code"]} for b in barcodes],
    }


@app.get("/api/admin/stores/{store}/assignments")
def admin_assignments(store: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                aza.article_code,
                a.description,
                aza.layout_id,
                aza.zone_id,
                aza.zone_code,
                aza.updated_at
            FROM article_zone_assignments aza
            LEFT JOIN articles a ON a.article_code = aza.article_code
            WHERE aza.store_code = ?
            ORDER BY aza.zone_code, aza.article_code
            """,
            (store,),
        ).fetchall()

    return [
        {
            "articleCode": row["article_code"],
            "description": row["description"],
            "layoutId": row["layout_id"],
            "zoneId": row["zone_id"],
            "zoneCode": row["zone_code"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]


@app.get("/api/stores/{store}/barcodes")
def barcodes(store: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                b.ean,
                b.article_code,
                a.description,
                b.color_code,
                b.size_code,
                a.image_url
            FROM store_articles s
            JOIN articles a ON a.article_code = s.article_code
            JOIN article_barcodes b ON b.article_code = a.article_code
            WHERE s.store_code = ? AND s.active_flag = 1
            ORDER BY b.ean
            """,
            (store,),
        ).fetchall()

    return [
        {
            "ean": row["ean"],
            "articleCode": row["article_code"],
            "description": row["description"],
            "colorCode": row["color_code"],
            "sizeCode": row["size_code"],
            "imageUrl": row["image_url"],
        }
        for row in rows
    ]


@app.get("/api/stores/{store}/layouts/active")
def active_layout(store: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT layout_json
            FROM layouts
            WHERE store_code = ? AND active_flag = 1
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (store,),
        ).fetchone()

    if not row:
        raise HTTPException(404, "Layout non trovato")

    return json.loads(row["layout_json"])


@app.post("/api/assignments")
def save_assignment(assignment: Assignment) -> dict[str, str]:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO article_zone_assignments(
                store_code,
                layout_id,
                article_code,
                zone_id,
                zone_code,
                scanned_ean,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(store_code, layout_id, article_code) DO UPDATE SET
                zone_id = excluded.zone_id,
                zone_code = excluded.zone_code,
                scanned_ean = excluded.scanned_ean,
                updated_at = excluded.updated_at
            """,
            (
                assignment.storeCode,
                assignment.layoutId,
                assignment.articleCode,
                assignment.zoneId,
                assignment.zoneCode,
                assignment.scannedEan,
                assignment.updatedAt,
            ),
        )

    return {"status": "SYNCED"}


@app.get("/api/stores/{store}/layouts/{layout}/assignments")
def assignments(store: str, layout: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM article_zone_assignments
            WHERE store_code = ? AND layout_id = ?
            ORDER BY zone_code, article_code
            """,
            (store, layout),
        ).fetchall()

    return [dict(row) for row in rows]


app.mount(
    "/",
    StaticFiles(directory=PUBLIC_DIR, html=True),
    name="public",
)
