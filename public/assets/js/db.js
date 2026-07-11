const DB_NAME = "ZoneMindDB";
const DB_VERSION = 1;

let dbInstance = null;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("barcodeArticles")) {
        db.createObjectStore("barcodeArticles", {
          keyPath: "ean"
        });
      }

      if (!db.objectStoreNames.contains("assignments")) {
        const store = db.createObjectStore("assignments", {
          keyPath: "articleCode"
        });

        store.createIndex("byZoneId", "zoneId", {
          unique: false
        });
      }
    };

    request.onsuccess = event => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveBarcodeArticles(records) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      "barcodeArticles",
      "readwrite"
    );

    const store = transaction.objectStore("barcodeArticles");

    records.forEach(record => store.put(record));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function findArticleByEan(ean) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      "barcodeArticles",
      "readonly"
    );

    const store = transaction.objectStore("barcodeArticles");
    const request = store.get(ean);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAssignmentByArticle(articleCode) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      "assignments",
      "readonly"
    );

    const store = transaction.objectStore("assignments");
    const request = store.get(articleCode);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAssignment(assignment) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      "assignments",
      "readwrite"
    );

    transaction
      .objectStore("assignments")
      .put(assignment);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllAssignments() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      "assignments",
      "readonly"
    );

    const request = transaction
      .objectStore("assignments")
      .getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}