import {
  saveBarcodeArticles,
  findArticleByEan,
  getAssignmentByArticle,
  saveAssignment,
  getAllAssignments,
  saveUnresolvedBarcode
} from "./db.js";

let layout = null;
let selectedZone = null;

let scanner = null;
let scannerRunning = false;
let barcodeProcessing = false;

let associatedCount = 0;
let unresolvedCount = 0;

let lastScannedEan = null;
let lastScanTime = 0;

const DUPLICATE_SCAN_INTERVAL = 1500;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  try {
    await loadBarcodeData();
    await loadLayout();

    renderZones();
    await renderAssignments();

    document
      .getElementById("changeZoneButton")
      .addEventListener("click", changeZone);

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
  const response = await fetch(
    "./data/layout-demo.json"
  );

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

      button.addEventListener("click", async () => {
        await selectZone(zone);
      });

      container.appendChild(button);
    });
}

async function selectZone(zone) {
  selectedZone = zone;

  associatedCount = 0;
  unresolvedCount = 0;
  updateSessionSummary();

  document.getElementById("scannerPanel").hidden = false;
  document.body.classList.add("scanner-active");

  document.getElementById("scannerTitle").textContent =
    selectedZone.zoneCode;

  showMessage(
    `Scanner attivo sulla zona ${selectedZone.zoneCode}`,
    ""
  );

  await startScanner();
}

async function startScanner() {
  if (!selectedZone || scannerRunning) {
    return;
  }

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      {
        facingMode: "environment"
      },
      {
        fps: 12,

        qrbox: function (viewfinderWidth, viewfinderHeight) {
          const width = Math.min(
            Math.floor(viewfinderWidth * 0.82),
            420
          );

          const height = Math.min(
            Math.floor(viewfinderHeight * 0.28),
            150
          );

          return {
            width,
            height
          };
        },

        aspectRatio: 1.7778,

        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128
        ]
      },
      handleBarcode,
      () => {
        // Gli errori di mancata lettura durante
        // l'inquadratura sono normali.
      }
    );

    scannerRunning = true;

  } catch (error) {
    showMessage(
      `Impossibile avviare la fotocamera: ${error}`,
      "error"
    );

    console.error(error);
  }
}

async function handleBarcode(ean) {
  if (!selectedZone || barcodeProcessing) {
    return;
  }

  if (isRepeatedCameraReading(ean)) {
    return;
  }

  barcodeProcessing = true;

  try {
    const barcodeRecord = await findArticleByEan(ean);

    if (!barcodeRecord) {
      await registerUnresolvedBarcode(ean);

      unresolvedCount += 1;
      updateSessionSummary();

      showTemporaryMessage(
        `EAN ${ean} non riconosciuto. Registrato per verifica.`,
        "warning"
      );

      return;
    }

    const existingAssignment =
      await getAssignmentByArticle(
        barcodeRecord.articleCode
      );

    /*
     * Caso importante:
     * è già lo stesso articolo nella stessa zona.
     *
     * Potrebbe essere una SKU con taglia o colore diverso.
     * Non mostriamo avvisi e non aggiorniamo contatori.
     */
    if (
      existingAssignment &&
      existingAssignment.zoneId === selectedZone.zoneId
    ) {
      return;
    }

    /*
     * L'articolo è già associato a una zona differente:
     * questo è l'unico controllo forte.
     */
    if (
      existingAssignment &&
      existingAssignment.zoneId !== selectedZone.zoneId
    ) {
      await handleZoneConflict(
        barcodeRecord,
        existingAssignment
      );

      return;
    }

    await createAssignment(barcodeRecord);

    associatedCount += 1;
    updateSessionSummary();

    showTemporaryMessage(
      `${barcodeRecord.articleCode} associato a ${selectedZone.zoneCode}`,
      "success"
    );

    await renderAssignments();

  } catch (error) {
    showMessage(
      `Errore durante la scansione: ${error.message}`,
      "error"
    );

    console.error(error);

  } finally {
    barcodeProcessing = false;
  }
}

function isRepeatedCameraReading(ean) {
  const currentTime = Date.now();

  if (
    ean === lastScannedEan &&
    currentTime - lastScanTime < DUPLICATE_SCAN_INTERVAL
  ) {
    return true;
  }

  lastScannedEan = ean;
  lastScanTime = currentTime;

  return false;
}

async function handleZoneConflict(
  barcodeRecord,
  existingAssignment
) {
  const moveConfirmed = confirm(
    `L'articolo ${barcodeRecord.articleCode} è già associato ` +
    `alla zona ${existingAssignment.zoneCode}.\n\n` +
    `Vuoi spostarlo nella zona ${selectedZone.zoneCode}?`
  );

  if (!moveConfirmed) {
    showTemporaryMessage(
      `Articolo mantenuto nella zona ${existingAssignment.zoneCode}`,
      "warning"
    );

    return;
  }

  await createAssignment(barcodeRecord);

  associatedCount += 1;
  updateSessionSummary();

  showTemporaryMessage(
    `${barcodeRecord.articleCode} spostato da ` +
    `${existingAssignment.zoneCode} a ${selectedZone.zoneCode}`,
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

async function registerUnresolvedBarcode(ean) {
  const unresolvedKey = [
    layout.layoutId,
    selectedZone.zoneId,
    ean
  ].join("|");

  await saveUnresolvedBarcode({
    unresolvedKey,
    ean,

    storeCode: layout.storeCode,
    layoutId: layout.layoutId,

    zoneId: selectedZone.zoneId,
    zoneCode: selectedZone.zoneCode,

    scannedAt: new Date().toISOString(),

    reason: "EAN_NOT_FOUND",
    status: "PENDING"
  });
}

async function changeZone() {
  await stopScanner();

  selectedZone = null;
  lastScannedEan = null;
  lastScanTime = 0;

  document.getElementById("scannerPanel").hidden = true;
  document.body.classList.remove("scanner-active");

  showMessage(
    "Seleziona una nuova zona",
    ""
  );
}

async function stopScanner() {
  if (!scanner) {
    scannerRunning = false;
    return;
  }

  try {
    if (scannerRunning) {
      await scanner.stop();
    }

    scanner.clear();

  } catch (error) {
    console.error("Errore arresto scanner:", error);

  } finally {
    scannerRunning = false;
    scanner = null;
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
      a.zoneCode.localeCompare(b.zoneCode) ||
      a.articleCode.localeCompare(b.articleCode)
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

function updateSessionSummary() {
  document.getElementById("associatedCount").textContent =
    associatedCount;

  document.getElementById("unresolvedCount").textContent =
    unresolvedCount;
}

function showMessage(text, className = "") {
  const element = document.getElementById("message");

  element.textContent = text;
  element.className = className;
}

function showTemporaryMessage(
  text,
  className,
  duration = 1800
) {
  showMessage(text, className);

  window.setTimeout(() => {
    if (selectedZone) {
      showMessage(
        `Scanner attivo sulla zona ${selectedZone.zoneCode}`,
        ""
      );
    }
  }, duration);
}