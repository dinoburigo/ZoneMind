import {
  saveBarcodeArticles,
  findArticleByEan,
  getAssignmentByArticle,
  saveAssignment,
  getAllAssignments,
  saveUnresolvedBarcode
} from "./db.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const DUPLICATE_SCAN_INTERVAL = 1500;

let layout = null;
let selectedZone = null;
let scanner = null;
let scannerRunning = false;
let barcodeProcessing = false;
let unresolvedCount = 0;
let zoneArticleCounts = new Map();
let lastScannedEan = null;
let lastScanTime = 0;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  try {
    await loadBarcodeData();
    await loadLayout();
    await refreshZoneCounts();
    renderFloorplan();
    renderZoneSummary();
    updateSelectedZonePanel();

    document
      .getElementById("changeZoneButton")
      .addEventListener("click", finishReading);
  } catch (error) {
    showMessage(`Errore inizializzazione: ${error.message}`, "error");
    console.error(error);
  }
}

async function loadBarcodeData() {
  const response = await fetch("./data/barcode-articles-demo.json");
  if (!response.ok) {
    throw new Error("Archivio EAN non disponibile");
  }
  await saveBarcodeArticles(await response.json());
}

async function loadLayout() {
  const response = await fetch("./data/layout-current.json", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Layout non disponibile: HTTP ${response.status}`);
  }

  const loadedLayout = await response.json();
  validateLayout(loadedLayout);
  layout = loadedLayout;

  document.getElementById("storeInfo").textContent =
    `${layout.storeCode} - ${layout.layoutCode}`;
}

function validateLayout(loadedLayout) {
  if (!loadedLayout || typeof loadedLayout !== "object") {
    throw new Error("Struttura layout non valida");
  }
  if (!loadedLayout.storeCode) {
    throw new Error("Store non presente nel layout");
  }
  if (!loadedLayout.layoutId) {
    throw new Error("Layout ID non presente");
  }
  if (!loadedLayout.image?.dataUrl) {
    throw new Error("Immagine della planimetria non presente");
  }
  if (!Array.isArray(loadedLayout.zones)) {
    throw new Error("Elenco zone non presente");
  }

  const invalidZone = loadedLayout.zones.find(zone =>
    !zone.zoneId || !zone.zoneCode || !zone.geometry
  );

  if (invalidZone) {
    throw new Error("Una o più zone non rispettano lo schema previsto");
  }
}

function getMonitoredZones() {
  return layout.zones.filter(zone => zone.monitoringEnabled !== false);
}

function renderFloorplan() {
  const image = document.getElementById("floorplanImage");
  const layer = document.getElementById("zoneLayer");

  image.src = layout.image.dataUrl;
  layer.setAttribute(
    "viewBox",
    `0 0 ${layout.image.width} ${layout.image.height}`
  );
  layer.innerHTML = "";

  getMonitoredZones().forEach(zone => {
    const group = document.createElementNS(SVG_NS, "g");
    group.classList.add("map-zone");
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");

    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", zone.geometry.x);
    rect.setAttribute("y", zone.geometry.y);
    rect.setAttribute("width", zone.geometry.width);
    rect.setAttribute("height", zone.geometry.height);
    rect.classList.add("map-zone-shape");

    if (getZoneCount(zone.zoneId) > 0) {
      rect.classList.add("has-articles");
    }
    if (selectedZone?.zoneId === zone.zoneId) {
      rect.classList.add("selected");
    }

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", zone.geometry.x + zone.geometry.width / 2);
    label.setAttribute("y", zone.geometry.y + zone.geometry.height / 2);
    label.classList.add("map-zone-label");
    label.textContent = `${zone.zoneCode} · ${getZoneCount(zone.zoneId)}`;

    const activate = async event => {
      event.preventDefault();
      await openScannerForZone(zone);
    };

    group.addEventListener("click", activate);
    group.addEventListener("keydown", async event => {
      if (event.key === "Enter" || event.key === " ") {
        await activate(event);
      }
    });

    group.appendChild(rect);
    group.appendChild(label);
    layer.appendChild(group);
  });
}

function renderZoneSummary() {
  const container = document.getElementById("zoneSummaryList");
  container.innerHTML = "";

  const zones = getMonitoredZones();
  if (zones.length === 0) {
    container.textContent = "Nessuna zona monitorata nel layout.";
    return;
  }

  zones.forEach(zone => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zone-summary-button";

    if (selectedZone?.zoneId === zone.zoneId) {
      button.classList.add("selected");
    }

    const count = getZoneCount(zone.zoneId);
    button.innerHTML = `
      <strong>${zone.zoneCode}</strong>
      <span class="zone-summary-count">
        <strong>${count}</strong>
        <span>${count === 1 ? "articolo" : "articoli"}</span>
      </span>
    `;

    button.addEventListener("click", () => {
      selectedZone = zone;
      renderFloorplan();
      renderZoneSummary();
      updateSelectedZonePanel();
    });

    container.appendChild(button);
  });
}

function updateSelectedZonePanel() {
  const section = document.getElementById("selectedZoneSection");

  if (!selectedZone) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  document.getElementById("selectedZoneCode").textContent =
    selectedZone.zoneCode;
  document.getElementById("selectedZoneArticleCount").textContent =
    getZoneCount(selectedZone.zoneId);
}

async function openScannerForZone(zone) {
  selectedZone = zone;
  unresolvedCount = 0;

  renderFloorplan();
  renderZoneSummary();
  updateSelectedZonePanel();
  updateScannerSummary();

  document.getElementById("scannerPanel").hidden = false;
  document.body.classList.add("scanner-active");
  document.getElementById("scannerTitle").textContent = zone.zoneCode;

  showMessage(`Scanner attivo sulla zona ${zone.zoneCode}`);
  await startScanner();
}

async function startScanner() {
  if (!selectedZone || scannerRunning) return;

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 12,
        qrbox(viewfinderWidth, viewfinderHeight) {
          return {
            width: Math.min(Math.floor(viewfinderWidth * 0.82), 420),
            height: Math.min(Math.floor(viewfinderHeight * 0.28), 150)
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
      () => {}
    );

    scannerRunning = true;
  } catch (error) {
    showMessage(`Impossibile avviare la fotocamera: ${error}`, "error");
    console.error(error);
  }
}

async function handleBarcode(ean) {
  if (!selectedZone || barcodeProcessing || isRepeatedCameraReading(ean)) {
    return;
  }

  barcodeProcessing = true;

  try {
    const barcodeRecord = await findArticleByEan(ean);

    if (!barcodeRecord) {
      await registerUnresolvedBarcode(ean);
      unresolvedCount += 1;
      updateScannerSummary();
      showTemporaryMessage(
        `EAN ${ean} non riconosciuto. Registrato per verifica.`,
        "warning"
      );
      return;
    }

    const existingAssignment =
      await getAssignmentByArticle(barcodeRecord.articleCode);

    if (
      existingAssignment &&
      existingAssignment.zoneId === selectedZone.zoneId
    ) {
      showTemporaryMessage(
        `${barcodeRecord.articleCode} è già presente in ${selectedZone.zoneCode}`
      );
      return;
    }

    if (
      existingAssignment &&
      existingAssignment.zoneId !== selectedZone.zoneId
    ) {
      await handleZoneConflict(barcodeRecord, existingAssignment);
      return;
    }

    await createAssignment(barcodeRecord);
    await refreshInterfaceAfterAssignment();

    showTemporaryMessage(
      `${barcodeRecord.articleCode} associato a ${selectedZone.zoneCode}`,
      "success"
    );
  } catch (error) {
    showMessage(`Errore durante la scansione: ${error.message}`, "error");
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

async function handleZoneConflict(barcodeRecord, existingAssignment) {
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
  await refreshInterfaceAfterAssignment();

  showTemporaryMessage(
    `${barcodeRecord.articleCode} spostato da ` +
    `${existingAssignment.zoneCode} a ${selectedZone.zoneCode}`,
    "success"
  );
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
  const unresolvedKey = [layout.layoutId, selectedZone.zoneId, ean].join("|");

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

async function refreshInterfaceAfterAssignment() {
  await refreshZoneCounts();
  renderFloorplan();
  renderZoneSummary();
  updateSelectedZonePanel();
  updateScannerSummary();
}

async function refreshZoneCounts() {
  const assignments = await getAllAssignments();
  const articleSets = new Map();

  assignments
    .filter(assignment => assignment.layoutId === layout.layoutId)
    .forEach(assignment => {
      if (!articleSets.has(assignment.zoneId)) {
        articleSets.set(assignment.zoneId, new Set());
      }
      articleSets.get(assignment.zoneId).add(assignment.articleCode);
    });

  zoneArticleCounts = new Map(
    [...articleSets.entries()].map(([zoneId, articles]) => [
      zoneId,
      articles.size
    ])
  );
}

function getZoneCount(zoneId) {
  return zoneArticleCounts.get(zoneId) || 0;
}

async function finishReading() {
  await stopScanner();
  lastScannedEan = null;
  lastScanTime = 0;

  document.getElementById("scannerPanel").hidden = true;
  document.body.classList.remove("scanner-active");

  await refreshZoneCounts();
  renderFloorplan();
  renderZoneSummary();
  updateSelectedZonePanel();

  document.getElementById("selectedZoneSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
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

function updateScannerSummary() {
  document.getElementById("associatedCount").textContent =
    selectedZone ? getZoneCount(selectedZone.zoneId) : 0;
  document.getElementById("unresolvedCount").textContent = unresolvedCount;
}

function showMessage(text, className = "") {
  const element = document.getElementById("message");
  element.textContent = text;
  element.className = className;
}

function showTemporaryMessage(text, className = "", duration = 1800) {
  showMessage(text, className);

  window.setTimeout(() => {
    if (selectedZone && scannerRunning) {
      showMessage(`Scanner attivo sulla zona ${selectedZone.zoneCode}`);
    }
  }, duration);
}
