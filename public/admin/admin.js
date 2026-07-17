const elements = {
  apiDot: document.getElementById("apiDot"),
  apiStatus: document.getElementById("apiStatus"),
  storeSelect: document.getElementById("storeSelect"),
  refreshButton: document.getElementById("refreshButton"),
  emptyState: document.getElementById("emptyState"),
  dashboard: document.getElementById("dashboard"),
  articleCount: document.getElementById("articleCount"),
  barcodeCount: document.getElementById("barcodeCount"),
  zoneCount: document.getElementById("zoneCount"),
  layoutCode: document.getElementById("layoutCode"),
  assignmentCount: document.getElementById("assignmentCount"),
  lastImport: document.getElementById("lastImport"),
  catalogForm: document.getElementById("catalogForm"),
  csvFile: document.getElementById("csvFile"),
  replaceCatalog: document.getElementById("replaceCatalog"),
  catalogMessage: document.getElementById("catalogMessage"),
  layoutForm: document.getElementById("layoutForm"),
  layoutFile: document.getElementById("layoutFile"),
  layoutMessage: document.getElementById("layoutMessage"),
  articleSearch: document.getElementById("articleSearch"),
  articleTableBody: document.getElementById("articleTableBody"),
  articleEmpty: document.getElementById("articleEmpty"),
  assignmentTableBody: document.getElementById("assignmentTableBody"),
  assignmentEmpty: document.getElementById("assignmentEmpty")
};

let currentStore = null;
let searchTimer = null;

initialize();

async function initialize() {
  bindEvents();

  try {
    const health = await fetchJson("/api/health");
    setApiStatus(true, `API ${health.version}`);
    await loadStores();
  } catch (error) {
    setApiStatus(false, "API non disponibile");
    showMessage(elements.catalogMessage, error.message, "error");
  }
}

function bindEvents() {
  elements.storeSelect.addEventListener("change", async event => {
    currentStore = event.target.value;
    await loadDashboard();
  });

  elements.refreshButton.addEventListener("click", loadStores);
  elements.catalogForm.addEventListener("submit", importCatalog);
  elements.layoutForm.addEventListener("submit", uploadLayout);

  elements.articleSearch.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadArticles, 300);
  });
}

async function loadStores() {
  const stores = await fetchJson("/api/admin/stores");
  const previousStore = currentStore;

  elements.storeSelect.innerHTML = "";

  if (stores.length === 0) {
    currentStore = null;
    elements.emptyState.hidden = false;
    elements.dashboard.hidden = true;
    return;
  }

  stores.forEach(store => {
    const option = document.createElement("option");
    option.value = store.storeCode;
    option.textContent = `${store.storeCode} - ${store.storeName}`;
    elements.storeSelect.appendChild(option);
  });

  currentStore = stores.some(store => store.storeCode === previousStore)
    ? previousStore
    : stores[0].storeCode;

  elements.storeSelect.value = currentStore;
  elements.emptyState.hidden = true;
  elements.dashboard.hidden = false;

  await loadDashboard();
}

async function loadDashboard() {
  if (!currentStore) {
    return;
  }

  const [summary] = await Promise.all([
    fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/summary`),
    loadArticles(),
    loadAssignments()
  ]);

  elements.articleCount.textContent = summary.catalog.articleCount;
  elements.barcodeCount.textContent = summary.catalog.barcodeCount;
  elements.assignmentCount.textContent = summary.assignmentCount;

  if (summary.layout) {
    elements.zoneCount.textContent = summary.layout.zoneCount;
    elements.layoutCode.textContent = summary.layout.layoutCode;
  } else {
    elements.zoneCount.textContent = "0";
    elements.layoutCode.textContent = "nessun layout";
  }

  elements.lastImport.textContent = summary.lastImport
    ? `Ultimo import: ${formatDate(summary.lastImport.imported_at)} · ` +
      `${summary.lastImport.rows_imported} EAN`
    : "Nessun import registrato";
}

async function importCatalog(event) {
  event.preventDefault();

  const file = elements.csvFile.files[0];
  if (!file) {
    showMessage(elements.catalogMessage, "Seleziona un CSV.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  showMessage(elements.catalogMessage, "Importazione in corso...", "");

  try {
    const result = await fetchJson(
      `/api/import/articles?replaceStoreCatalog=${elements.replaceCatalog.checked}`,
      { method: "POST", body: formData }
    );

    currentStore = result.storeCode;
    showMessage(
      elements.catalogMessage,
      `${result.rowsImported} EAN importati, ` +
      `${result.distinctArticles} articoli, ` +
      `${result.rowsRejected} scarti.`,
      result.rowsRejected ? "warning" : "success"
    );

    elements.catalogForm.reset();
    elements.replaceCatalog.checked = true;
    await loadStores();
  } catch (error) {
    showMessage(elements.catalogMessage, error.message, "error");
  }
}

async function uploadLayout(event) {
  event.preventDefault();

  const file = elements.layoutFile.files[0];
  if (!file) {
    showMessage(elements.layoutMessage, "Seleziona un JSON.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  showMessage(elements.layoutMessage, "Pubblicazione in corso...", "");

  try {
    const result = await fetchJson("/api/admin/layouts", {
      method: "POST",
      body: formData
    });

    currentStore = result.storeCode;
    showMessage(
      elements.layoutMessage,
      `${result.layoutCode} pubblicato con ${result.zoneCount} zone.`,
      "success"
    );

    elements.layoutForm.reset();
    await loadStores();
  } catch (error) {
    showMessage(elements.layoutMessage, error.message, "error");
  }
}

async function loadArticles() {
  if (!currentStore) {
    return;
  }

  const search = elements.articleSearch.value.trim();
  const result = await fetchJson(
    `/api/admin/stores/${encodeURIComponent(currentStore)}/articles` +
    `?search=${encodeURIComponent(search)}&limit=100`
  );

  elements.articleTableBody.innerHTML = "";
  elements.articleEmpty.hidden = result.items.length > 0;

  result.items.forEach(article => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(article.articleCode)}</strong></td>
      <td>${escapeHtml(article.description || "-")}</td>
      <td>${article.barcodeCount}</td>
    `;
    elements.articleTableBody.appendChild(row);
  });
}

async function loadAssignments() {
  if (!currentStore) {
    return;
  }

  const assignments = await fetchJson(
    `/api/admin/stores/${encodeURIComponent(currentStore)}/assignments`
  );

  elements.assignmentTableBody.innerHTML = "";
  elements.assignmentEmpty.hidden = assignments.length > 0;

  assignments.forEach(assignment => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(assignment.zoneCode)}</strong></td>
      <td>${escapeHtml(assignment.articleCode)}</td>
      <td>${escapeHtml(assignment.description || "-")}</td>
      <td>${formatDate(assignment.updatedAt)}</td>
    `;
    elements.assignmentTableBody.appendChild(row);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.detail || `HTTP ${response.status}`);
  }

  return payload;
}

function setApiStatus(ok, text) {
  elements.apiDot.classList.toggle("ok", ok);
  elements.apiDot.classList.toggle("error", !ok);
  elements.apiStatus.textContent = text;
}

function showMessage(element, text, type) {
  element.hidden = false;
  element.textContent = text;
  element.className = `message ${type}`.trim();
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("it-IT");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
