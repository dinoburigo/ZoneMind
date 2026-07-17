import csv, io, json
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from .database import get_connection, initialize_database
BASE_DIR = Path(__file__).resolve().parents[2]
PUBLIC_DIR = BASE_DIR / 'public'
app = FastAPI(title='ZoneMind API', version='0.6.0')
class Assignment(BaseModel):
    articleCode:str; scannedEan:str|None=None; storeCode:str; layoutId:str; zoneId:str; zoneCode:str; updatedAt:str
@app.on_event('startup')
def startup():
    initialize_database()
    p=PUBLIC_DIR/'data'/'layout-current.json'
    if p.exists():
        l=json.loads(p.read_text(encoding='utf-8'))
        with get_connection() as c:
            c.execute('INSERT OR REPLACE INTO stores(store_code,store_name) VALUES(?,?)',(l['storeCode'],l['storeCode']))
            c.execute('UPDATE layouts SET active_flag=0 WHERE store_code=?',(l['storeCode'],))
            c.execute('INSERT OR REPLACE INTO layouts(layout_id,store_code,layout_code,layout_json,active_flag) VALUES(?,?,?,?,1)',(l['layoutId'],l['storeCode'],l.get('layoutCode','LAYOUT001'),json.dumps(l,ensure_ascii=False)))
@app.get('/api/health')
def health(): return {'status':'ok','version':'0.6.0'}
@app.post('/api/import/articles')
async def import_articles(file:UploadFile=File(...), replaceStoreCatalog:bool=True):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400,'Caricare un CSV')
    text=(await file.read()).decode('utf-8-sig')
    rows=list(csv.DictReader(io.StringIO(text)))
    required={'storeCode','ean','articleCode','description'}
    if not rows or not required.issubset(rows[0].keys()): raise HTTPException(400,'Colonne CSV non valide')
    stores={r['storeCode'].strip() for r in rows}
    if len(stores)!=1: raise HTTPException(400,'Il CSV deve contenere un solo negozio')
    store=next(iter(stores)); imported=0; articles=set(); errors=[]
    with get_connection() as c:
        c.execute('INSERT OR REPLACE INTO stores(store_code,store_name) VALUES(?,?)',(store,store))
        if replaceStoreCatalog: c.execute('DELETE FROM store_articles WHERE store_code=?',(store,))
        for i,r in enumerate(rows,2):
            try:
                ean=r['ean'].strip(); art=r['articleCode'].strip(); desc=r['description'].strip()
                if not ean or not art: raise ValueError('EAN o articolo mancante')
                c.execute('INSERT OR REPLACE INTO articles(article_code,description,image_url) VALUES(?,?,?)',(art,desc,(r.get('imageUrl') or '').strip() or None))
                c.execute('INSERT OR REPLACE INTO article_barcodes(ean,article_code,color_code,size_code) VALUES(?,?,?,?)',(ean,art,(r.get('colorCode') or '').strip() or None,(r.get('sizeCode') or '').strip() or None))
                c.execute('INSERT OR REPLACE INTO store_articles(store_code,article_code,active_flag) VALUES(?,?,1)',(store,art))
                imported+=1; articles.add(art)
            except Exception as ex: errors.append(f'Riga {i}: {ex}')
    return {'storeCode':store,'rowsRead':len(rows),'rowsImported':imported,'rowsRejected':len(errors),'distinctArticles':len(articles),'errors':errors[:100]}
@app.get('/api/stores/{store}/barcodes')
def barcodes(store:str):
    with get_connection() as c:
        rs=c.execute('SELECT b.ean,b.article_code,a.description,b.color_code,b.size_code,a.image_url FROM store_articles s JOIN articles a ON a.article_code=s.article_code JOIN article_barcodes b ON b.article_code=a.article_code WHERE s.store_code=? AND s.active_flag=1',(store,)).fetchall()
    return [{'ean':r['ean'],'articleCode':r['article_code'],'description':r['description'],'colorCode':r['color_code'],'sizeCode':r['size_code'],'imageUrl':r['image_url']} for r in rs]
@app.get('/api/stores/{store}/layouts/active')
def active_layout(store:str):
    with get_connection() as c: r=c.execute('SELECT layout_json FROM layouts WHERE store_code=? AND active_flag=1 ORDER BY updated_at DESC LIMIT 1',(store,)).fetchone()
    if not r: raise HTTPException(404,'Layout non trovato')
    return json.loads(r['layout_json'])
@app.post('/api/assignments')
def save_assignment(a:Assignment):
    with get_connection() as c:
        c.execute('INSERT OR REPLACE INTO article_zone_assignments(store_code,layout_id,article_code,zone_id,zone_code,scanned_ean,updated_at) VALUES(?,?,?,?,?,?,?)',(a.storeCode,a.layoutId,a.articleCode,a.zoneId,a.zoneCode,a.scannedEan,a.updatedAt))
    return {'status':'SYNCED'}
@app.get('/api/stores/{store}/layouts/{layout}/assignments')
def assignments(store:str,layout:str):
    with get_connection() as c: rs=c.execute('SELECT * FROM article_zone_assignments WHERE store_code=? AND layout_id=? ORDER BY zone_code,article_code',(store,layout)).fetchall()
    return [dict(r) for r in rs]
app.mount('/',StaticFiles(directory=PUBLIC_DIR,html=True),name='public')
