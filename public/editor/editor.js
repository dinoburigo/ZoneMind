const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const MIN_ZONE_SIZE = 10;

const ZONE_COLORS = [
  "#90caf9",
  "#a5d6a7",
  "#ffcc80",
  "#ce93d8",
  "#ef9a9a",
  "#80cbc4",
  "#fff59d",
  "#b0bec5"
];

const state = {
  imageDataUrl: null,
  imageName: null,
  imageWidth: 0,
  imageHeight: 0,

  zones: [],

  drawingMode: false,
  drawing: false,

  startX: 0,
  startY: 0,

  previewRect: null,
  selectedZoneId: null
};

const elements = {
  loadImageButton: document.getElementById("loadImageButton"),
  newZoneButton: document.getElementById("newZoneButton"),
  finishEditingButton: document.getElementById(
    "finishEditingButton"
  ),
  deleteZoneButton: document.getElementById(
    "deleteZoneButton"
  ),
  importJsonButton: document.getElementById("importJsonButton"),
  exportJsonButton: document.getElementById("exportJsonButton"),

  imageInput: document.getElementById("imageInput"),
  jsonInput: document.getElementById("jsonInput"),

  emptyState: document.getElementById("emptyState"),
  editorArea: document.getElementById("editorArea"),
  mapContainer: document.getElementById("mapContainer"),

  floorplanImage: document.getElementById("floorplanImage"),
  zoneLayer: document.getElementById("zoneLayer"),

  statusBar: document.getElementById("statusBar"),
  modeIndicator: document.getElementById("modeIndicator"),
  zoneCounter: document.getElementById("zoneCounter")
};

initialize();

function initialize() {
  elements.loadImageButton.addEventListener(
    "click",
    () => elements.imageInput.click()
  );

  elements.imageInput.addEventListener(
    "change",
    handleImageSelection
  );

  elements.newZoneButton.addEventListener(
    "click",
    startDrawingMode
  );

  elements.finishEditingButton.addEventListener(
    "click",
    stopDrawingMode
  );

  elements.deleteZoneButton.addEventListener(
    "click",
    deleteSelectedZone
  );

  elements.importJsonButton.addEventListener(
    "click",
    () => elements.jsonInput.click()
  );

  elements.jsonInput.addEventListener(
    "change",
    handleJsonImport
  );

  elements.exportJsonButton.addEventListener(
    "click",
    exportLayout
  );

  elements.zoneLayer.addEventListener(
    "pointerdown",
    handlePointerDown
  );

  elements.zoneLayer.addEventListener(
    "pointermove",
    handlePointerMove
  );

  elements.zoneLayer.addEventListener(
    "pointerup",
    handlePointerUp
  );

  elements.zoneLayer.addEventListener(
    "pointercancel",
    cancelCurrentDrawing
  );

  document.addEventListener("keydown", handleKeyboard);
}

function handleImageSelection(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    loadFloorplan(reader.result, file.name);

    state.zones = [];
    state.selectedZoneId = null;

    renderZones();

    setStatus(
      "Planimetria caricata. Premi “Nuova zona” per iniziare.",
      "success"
    );
  };

  reader.onerror = () => {
    setStatus("Impossibile leggere l'immagine.");
  };

  reader.readAsDataURL(file);

  event.target.value = "";
}

function loadFloorplan(dataUrl, imageName) {
  const image = elements.floorplanImage;

  image.onload = () => {
    state.imageDataUrl = dataUrl;
    state.imageName = imageName;

    state.imageWidth = image.naturalWidth;
    state.imageHeight = image.naturalHeight;

    elements.zoneLayer.setAttribute(
      "viewBox",
      `0 0 ${state.imageWidth} ${state.imageHeight}`
    );

    elements.emptyState.hidden = true;
    elements.editorArea.hidden = false;

    updateButtons();
  };

  image.src = dataUrl;
}

function startDrawingMode() {
  if (!state.imageDataUrl) {
    setStatus("Apri prima una planimetria.");
    return;
  }

  state.drawingMode = true;
  state.selectedZoneId = null;

  elements.mapContainer.classList.add("drawing-mode");
  elements.newZoneButton.classList.add("active");

  setStatus(
    "Modalità disegno: trascina sulla planimetria per creare le zone.",
    "drawing"
  );

  updateButtons();
  renderZones();
}

function stopDrawingMode() {
  state.drawingMode = false;
  state.drawing = false;

  removePreview();

  elements.mapContainer.classList.remove("drawing-mode");
  elements.newZoneButton.classList.remove("active");

  setStatus("Modalità selezione.");

  updateButtons();
}

function handlePointerDown(event) {
  const point = getSvgPoint(event);

  if (state.drawingMode) {
    event.preventDefault();

    state.drawing = true;
    state.startX = point.x;
    state.startY = point.y;

    elements.zoneLayer.setPointerCapture(event.pointerId);

    createPreview(point.x, point.y);
    return;
  }

  const zoneId = event.target.dataset.zoneId;

  if (zoneId) {
    selectZone(zoneId);
  } else {
    clearSelection();
  }
}

function handlePointerMove(event) {
  if (!state.drawingMode || !state.drawing) {
    return;
  }

  event.preventDefault();

  const point = getSvgPoint(event);

  updatePreview(point.x, point.y);
}

function handlePointerUp(event) {
  if (!state.drawingMode || !state.drawing) {
    return;
  }

  event.preventDefault();

  const point = getSvgPoint(event);

  const geometry = calculateGeometry(
    state.startX,
    state.startY,
    point.x,
    point.y
  );

  state.drawing = false;

  removePreview();

  if (
    geometry.width < MIN_ZONE_SIZE ||
    geometry.height < MIN_ZONE_SIZE
  ) {
    setStatus(
      "Zona troppo piccola: trascina un'area più grande.",
      "drawing"
    );

    return;
  }

  createZone(geometry);
}

function createZone(geometry) {
  const zoneCode = generateNextZoneCode();

  const newZone = {
    zoneId: crypto.randomUUID(),
    zoneCode,
    monitoringEnabled: true,

    color: ZONE_COLORS[
      state.zones.length % ZONE_COLORS.length
    ],

    geometryType: "RECTANGLE",

    geometry: {
      x: Math.round(geometry.x),
      y: Math.round(geometry.y),
      width: Math.round(geometry.width),
      height: Math.round(geometry.height)
    }
  };

  state.zones.push(newZone);
  state.selectedZoneId = newZone.zoneId;

  renderZones();

  setStatus(
    `${zoneCode} creata. Disegna la zona successiva.`,
    "success"
  );
}

function generateNextZoneCode() {
  const usedNumbers = new Set(
    state.zones
      .map(zone => {
        const match = /^A(\d+)$/i.exec(zone.zoneCode);

        return match ? Number(match[1]) : null;
      })
      .filter(value => value !== null)
  );

  let nextNumber = 1;

  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return `A${String(nextNumber).padStart(2, "0")}`;
}

function selectZone(zoneId) {
  state.selectedZoneId = zoneId;

  const zone = state.zones.find(
    item => item.zoneId === zoneId
  );

  if (zone) {
    setStatus(
      `${zone.zoneCode} selezionata. Premi “Elimina zona” per rimuoverla.`
    );
  }

  renderZones();
  updateButtons();
}

function clearSelection() {
  state.selectedZoneId = null;

  renderZones();
  updateButtons();

  setStatus("Modalità selezione.");
}

function deleteSelectedZone() {
  if (!state.selectedZoneId) {
    return;
  }

  const selectedZone = state.zones.find(
    zone => zone.zoneId === state.selectedZoneId
  );

  state.zones = state.zones.filter(
    zone => zone.zoneId !== state.selectedZoneId
  );

  state.selectedZoneId = null;

  renderZones();

  setStatus(
    `${selectedZone?.zoneCode ?? "Zona"} eliminata.`,
    "success"
  );
}

function renderZones() {
  elements.zoneLayer.innerHTML = "";

  state.zones.forEach(zone => {
    const group = document.createElementNS(
      SVG_NAMESPACE,
      "g"
    );

    const rect = document.createElementNS(
      SVG_NAMESPACE,
      "rect"
    );

    rect.setAttribute("x", zone.geometry.x);
    rect.setAttribute("y", zone.geometry.y);
    rect.setAttribute("width", zone.geometry.width);
    rect.setAttribute("height", zone.geometry.height);

    rect.setAttribute(
      "fill",
      hexToRgba(zone.color, 0.30)
    );

    rect.setAttribute("stroke", zone.color);

    rect.classList.add("zone-shape");

    if (zone.zoneId === state.selectedZoneId) {
      rect.classList.add("selected");
    }

    rect.dataset.zoneId = zone.zoneId;

    const label = document.createElementNS(
      SVG_NAMESPACE,
      "text"
    );

    label.setAttribute(
      "x",
      zone.geometry.x + zone.geometry.width / 2
    );

    label.setAttribute(
      "y",
      zone.geometry.y + zone.geometry.height / 2
    );

    label.classList.add("zone-label");
    label.textContent = zone.zoneCode;

    group.appendChild(rect);
    group.appendChild(label);

    elements.zoneLayer.appendChild(group);
  });

  updateButtons();
  updateCounters();
}

function createPreview(x, y) {
  removePreview();

  state.previewRect = document.createElementNS(
    SVG_NAMESPACE,
    "rect"
  );

  state.previewRect.classList.add("zone-preview");

  state.previewRect.setAttribute("x", x);
  state.previewRect.setAttribute("y", y);
  state.previewRect.setAttribute("width", 0);
  state.previewRect.setAttribute("height", 0);

  elements.zoneLayer.appendChild(state.previewRect);
}

function updatePreview(currentX, currentY) {
  if (!state.previewRect) {
    return;
  }

  const geometry = calculateGeometry(
    state.startX,
    state.startY,
    currentX,
    currentY
  );

  state.previewRect.setAttribute("x", geometry.x);
  state.previewRect.setAttribute("y", geometry.y);
  state.previewRect.setAttribute(
    "width",
    geometry.width
  );
  state.previewRect.setAttribute(
    "height",
    geometry.height
  );
}

function removePreview() {
  if (!state.previewRect) {
    return;
  }

  state.previewRect.remove();
  state.previewRect = null;
}

function cancelCurrentDrawing() {
  state.drawing = false;
  removePreview();
}

function calculateGeometry(startX, startY, endX, endY) {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),

    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

function getSvgPoint(event) {
  const point = elements.zoneLayer.createSVGPoint();

  point.x = event.clientX;
  point.y = event.clientY;

  return point.matrixTransform(
    elements.zoneLayer.getScreenCTM().inverse()
  );
}

function exportLayout() {
  if (!state.imageDataUrl) {
    setStatus("Non esiste una planimetria da esportare.");
    return;
  }

  const layout = {
    schemaVersion: "1.0",

    storeCode: "STORE001",

    layoutId: crypto.randomUUID(),
    layoutCode: "LAYOUT001",

    image: {
      name: state.imageName,
      width: state.imageWidth,
      height: state.imageHeight,

      /*
       * Per il prototipo includiamo l'immagine nel JSON.
       * In futuro l'immagine avrà un URL separato.
       */
      dataUrl: state.imageDataUrl
    },

    zones: state.zones
  };

  const json = JSON.stringify(layout, null, 2);

  const blob = new Blob(
    [json],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "zonemind-layout.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  setStatus("Layout esportato.", "success");
}

function handleJsonImport(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const layout = JSON.parse(reader.result);

      validateImportedLayout(layout);

      state.zones = layout.zones;
      state.selectedZoneId = null;

      loadFloorplan(
        layout.image.dataUrl,
        layout.image.name
      );

      /*
       * Il rendering viene eseguito dopo che
       * l'immagine è disponibile.
       */
      elements.floorplanImage.onload = () => {
        state.imageDataUrl = layout.image.dataUrl;
        state.imageName = layout.image.name;

        state.imageWidth = layout.image.width;
        state.imageHeight = layout.image.height;

        elements.zoneLayer.setAttribute(
          "viewBox",
          `0 0 ${state.imageWidth} ${state.imageHeight}`
        );

        elements.emptyState.hidden = true;
        elements.editorArea.hidden = false;

        renderZones();

        setStatus("Layout importato.", "success");
      };

      elements.floorplanImage.src =
        layout.image.dataUrl;

    } catch (error) {
      console.error(error);

      setStatus(
        `JSON non valido: ${error.message}`
      );
    }
  };

  reader.readAsText(file);

  event.target.value = "";
}

function validateImportedLayout(layout) {
  if (!layout || typeof layout !== "object") {
    throw new Error("contenuto non valido");
  }

  if (!layout.image?.dataUrl) {
    throw new Error("immagine non presente");
  }

  if (!Array.isArray(layout.zones)) {
    throw new Error("elenco zone non presente");
  }
}

function handleKeyboard(event) {
  if (
    (event.key === "Delete" ||
      event.key === "Backspace") &&
    state.selectedZoneId &&
    !state.drawingMode
  ) {
    event.preventDefault();
    deleteSelectedZone();
  }

  if (event.key === "Escape" && state.drawingMode) {
    stopDrawingMode();
  }
}

function updateButtons() {
  const hasImage = Boolean(state.imageDataUrl);
  const hasSelection = Boolean(state.selectedZoneId);

  elements.newZoneButton.disabled =
    !hasImage || state.drawingMode;

  elements.finishEditingButton.disabled =
    !state.drawingMode;

  elements.deleteZoneButton.disabled =
    state.drawingMode || !hasSelection;

  elements.exportJsonButton.disabled =
    !hasImage;

  elements.modeIndicator.textContent =
    state.drawingMode
      ? "Modalità: disegno continuo"
      : "Modalità: selezione";
}

function updateCounters() {
  elements.zoneCounter.textContent =
    `Zone: ${state.zones.length}`;
}

function setStatus(message, className = "") {
  elements.statusBar.textContent = message;

  elements.statusBar.className = "status-bar";

  if (className) {
    elements.statusBar.classList.add(className);
  }
}

function hexToRgba(hex, alpha) {
  const cleanHex = hex.replace("#", "");

  const red = parseInt(cleanHex.substring(0, 2), 16);
  const green = parseInt(cleanHex.substring(2, 4), 16);
  const blue = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}