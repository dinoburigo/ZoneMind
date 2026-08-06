from pathlib import Path

root = Path(__file__).resolve().parents[1]
main_path = root / "api" / "app" / "main.py"
index_path = root / "public" / "admin" / "index.html"

main_text = main_path.read_text(encoding="utf-8")
import_line = "from .dwh_stores import register_dwh_store_routes\n"
call_line = "register_dwh_store_routes(app)\n"

if import_line not in main_text:
    if "from .dwh_catalog import register_dwh_catalog_routes\n" in main_text:
        marker = "from .dwh_catalog import register_dwh_catalog_routes\n"
        main_text = main_text.replace(marker, marker + import_line)
    else:
        marker = "from .database import DB_PATH, get_connection, initialize_database\n"
        if marker not in main_text:
            raise SystemExit("Marker import database non trovato in main.py")
        main_text = main_text.replace(marker, marker + import_line)

if call_line not in main_text:
    if "register_dwh_catalog_routes(app)\n" in main_text:
        marker = "register_dwh_catalog_routes(app)\n"
        main_text = main_text.replace(marker, marker + call_line)
    else:
        marker = 'app = FastAPI(title="ZoneMind API", version=APP_VERSION)\n'
        if marker not in main_text:
            raise SystemExit("Marker app FastAPI non trovato in main.py")
        main_text = main_text.replace(marker, marker + call_line)

main_path.write_text(main_text, encoding="utf-8")

index_text = index_path.read_text(encoding="utf-8")
script_line = '  <script type="module" src="stores-dwh.js"></script>\n'
if 'src="stores-dwh.js"' not in index_text and 'src="./stores-dwh.js"' not in index_text:
    candidates = [
        '  <script type="module" src="catalog-dwh.js"></script>\n',
        '<script type="module" src="catalog-dwh.js"></script>\n',
        '  <script type="module" src="./catalog-dwh.js"></script>\n',
        '<script type="module" src="./catalog-dwh.js"></script>\n',
        '  <script type="module" src="admin.js"></script>\n',
        '<script type="module" src="admin.js"></script>\n',
        '  <script type="module" src="./admin.js"></script>\n',
        '<script type="module" src="./admin.js"></script>\n',
    ]
    for marker in candidates:
        if marker in index_text:
            index_text = index_text.replace(marker, marker + script_line, 1)
            break
    else:
        closing = "</body>"
        if closing not in index_text:
            raise SystemExit("Tag </body> non trovato in index.html")
        index_text = index_text.replace(closing, script_line + closing, 1)

index_path.write_text(index_text, encoding="utf-8")
print("Patch ZoneMind DWH Stores applicata correttamente.")
