# ZoneMind API 0.7.0

Nuovi endpoint Admin:

```http
GET /api/admin/stores
GET /api/admin/stores/{storeCode}/summary
GET /api/admin/stores/{storeCode}/articles
GET /api/admin/stores/{storeCode}/assignments
POST /api/admin/layouts
```

Restano disponibili gli endpoint 0.6:

```http
GET /api/health
POST /api/import/articles
GET /api/stores/{storeCode}/barcodes
GET /api/stores/{storeCode}/layouts/active
POST /api/assignments
GET /api/stores/{storeCode}/layouts/{layoutId}/assignments
```
