import {
  saveBarcodeArticles,
  findArticleByEan,
  getAssignmentByArticle,
  saveAssignment,
  getAllAssignments
} from "./db.js";

let layout = null;
let selectedZone = null;
let scanner = null;
let scannerRunning = false;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  try {
    await loadBarcodeData();
    await loadLayout();
    renderZones();
    await renderAssignments();

    document
      .getElementById("closeScannerButton")
      .addEventListener("click", stopScanner);

  } catch (error) {
    showMessage(
      `Errore inizializzazione: ${error.message}`,
      "error"
    );

    console.error(error);
  }
}

async function loadBarcodeData() {
  const response = await fetch(
    "./data/barcode-articles-demo.json"
  );

  if (!response.ok) {
    throw new Error("Archivio EAN non disponibile");
  }

  const records = await response.json();
  await saveBarcodeArticles(records);
}

async function loadLayout() {
  const response = await fetch("./data/layout-demo.json");

  if (!response.ok) {
    throw new Error("Layout non disponibile");
  }

  layout = await response.json();

  document.getElementById("storeInfo").textContent =
    `${layout.storeCode} - ${layout.layoutCode}`;
}

function renderZones() {
  const container = document.getElementById("zoneList");
  container.innerHTML = "";

  layout.zones
    .filter(zone => zone.monitoringEnabled)
    .forEach(zone => {
      const button = document.createElement("button");

      button.className = "zone-button";
      button.textContent = zone.zoneCode;

      button.addEventListener("click", () => {
        selectedZone = zone;
        startScanner();
      });

      container.appendChild(button);
    });
}

async function startScanner() {
  if (!selectedZone) {
    return;
  }

  document.getElementById("scannerPanel").hidden = false;

  document.getElementById("scannerTitle").textContent =
    `Scanner per zona ${selectedZone.zoneCode}`;

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: {
          width: 280,
          height: 140
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128
        ]
      },
      handleBarcode,
      () => {}
    );

    scannerRunning = true;

  } catch (error) {
    showMessage(
      `Impossibile avviare la fotocamera: ${error}`,
      "error"
    );
  }
}

async function handleBarcode(ean) {
  await stopScanner();

  const barcodeRecord = await findArticleByEan(ean);

  if (!barcodeRecord) {
    showMessage(
      `EAN ${ean} non riconosciuto`,
      "error"
    );

    return;
  }

  const existingAssignment =
    await getAssignmentByArticle(
      barcodeRecord.articleCode
    );

  if (!existingAssignment) {
    await createAssignment(barcodeRecord);

    showMessage(
      `Articolo ${barcodeRecord.articleCode} associato a ${selectedZone.zoneCode}`,
      "success"
    );

    await renderAssignments();
    return;
  }

  if (existingAssignment.zoneId === selectedZone.zoneId) {
    showMessage(
      `Articolo ${barcodeRecord.articleCode} già presente in ${selectedZone.zoneCode}`,
      "warning"
    );

    return;
  }

  const moveConfirmed = confirm(
    `L'articolo ${barcodeRecord.articleCode} è già associato alla zona ` +
    `${existingAssignment.zoneCode}.\n\n` +
    `Vuoi spostarlo in ${selectedZone.zoneCode}?`
  );

  if (!moveConfirmed) {
    showMessage("Operazione annullata", "warning");
    return;
  }

  await createAssignment(barcodeRecord);

  showMessage(
    `Articolo ${barcodeRecord.articleCode} spostato in ${selectedZone.zoneCode}`,
    "success"
  );

  await renderAssignments();
}

async function createAssignment(barcodeRecord) {
  await saveAssignment({
    articleCode: barcodeRecord.articleCode,
    scannedEan: barcodeRecord.ean,
    storeCode: layout.storeCode,
    layoutId: layout.layoutId,
    zoneId: selectedZone.zoneId,
    zoneCode: selectedZone.zoneCode,
    createdAt: new Date().toISOString(),
    syncStatus: "PENDING"
  });
}

async function stopScanner() {
  if (!scanner || !scannerRunning) {
    document.getElementById("scannerPanel").hidden = true;
    return;
  }

  try {
    await scanner.stop();
    scanner.clear();
  } catch (error) {
    console.error(error);
  } finally {
    scannerRunning = false;
    scanner = null;
    document.getElementById("scannerPanel").hidden = true;
  }
}

async function renderAssignments() {
  const assignments = await getAllAssignments();
  const container = document.getElementById("assignmentList");

  container.innerHTML = "";

  if (assignments.length === 0) {
    container.textContent = "Nessuna associazione";
    return;
  }

  assignments
    .sort((a, b) =>
      a.zoneCode.localeCompare(b.zoneCode)
    )
    .forEach(assignment => {
      const element = document.createElement("div");
      element.className = "assignment";

      element.textContent =
        `${assignment.zoneCode} → ${assignment.articleCode} ` +
        `(${assignment.syncStatus})`;

      container.appendChild(element);
    });
}

function showMessage(text, className) {
  const element = document.getElementById("message");

  element.textContent = text;
  element.className = className;
}