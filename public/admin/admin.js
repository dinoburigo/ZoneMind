import { fetchJson, postFile } from "../mapper/assets/js/components/api-client.js";
import { debounce, escapeHtml, formatDate } from "../mapper/assets/js/components/formatters.js";
import { initializeShell } from "../mapper/assets/js/components/app-shell.js";
import { showToast } from "../mapper/assets/js/components/toast.js";

const AUTO_REFRESH_MS = 30000;
const FRONTEND_VERSION = "0.9.2";

const ids = [
  "apiDot", "apiStatus", "autoRefreshStatus", "storeSelect", "refreshButton", "emptyState", "dashboard",
  "dashboardStoreName", "lastRefresh", "overallStatus", "articleCount", "barcodeCount", "zoneCount", "layoutCode",
  "assignmentCount", "coveragePercent", "coverageDetail", "coverageBar", "storeCount",
  "apiServiceDot", "apiServiceText", "databaseDot", "databaseText", "catalogDot", "catalogText", "layoutDot", "layoutText",
  "lastImport", "lastLayoutUpdate", "lastDashboardUpdate", "catalogForm", "csvFile", "replaceCatalog", "catalogMessage",
  "layoutForm", "layoutFile", "layoutMessage", "articleSearch", "articleTableBody", "articleEmpty", "assignmentTableBody", "assignmentEmpty",
  "pageTitle", "pageSubtitle", "storesPage", "newStoreButton", "storeForm", "storeFormTitle", "storeCodeInput", "storeNameInput",
  "storeCityInput", "storeCountryInput", "storeActiveInput", "cancelStoreButton", "storeMessage", "storeSearch", "storeTableBody", "storeEmpty",
  "catalogPage", "catalogRefreshButton", "catalogSearch", "catalogStatus", "catalogSort", "catalogPageSize", "catalogResultTitle",
  "catalogResultInfo", "catalogTableBody", "catalogEmpty", "catalogPrev", "catalogNext", "catalogPageInfo", "articleDrawer", "drawerBackdrop",
  "drawerClose", "drawerArticleCode", "drawerDescription", "drawerStore", "drawerZone", "drawerStatus", "drawerUpdated", "drawerBarcodes",
  "layoutsPage", "layoutRefreshButton", "newLayoutButton", "activeLayoutsStrip", "layoutTableBody", "layoutTableEmpty", "layoutPreviewPanel",
  "layoutPreviewTitle", "layoutZonePreview", "closeLayoutPreview", "layoutEditorPanel", "layoutEditorTitle", "cancelLayoutEdit", "layoutEditorForm",
  "layoutIdInput", "layoutNameInput", "layoutDescriptionInput", "layoutImageInput", "saveAndActivateLayout", "layoutEditorMessage",
  "layoutCanvas", "layoutImagePreview", "layoutSvg", "layoutCanvasEmpty", "newZoneButton", "deleteZoneButton", "clearZonesButton",
  "layoutZoneCounter", "layoutManagementForm", "layoutManagementFile", "layoutManagementMessage", "activeLayoutName", "activeLayoutMeta",
  "activeLayoutZones", "activeLayoutAssignments", "assignmentsPage", "assignmentsRefreshButton", "assignmentsSearch", "assignmentsZone",
  "assignmentsLayout", "assignmentsPageSize", "assignmentsResultTitle", "assignmentsResultInfo", "assignmentsManagementBody",
  "assignmentsManagementEmpty", "assignmentsPrev", "assignmentsNext", "assignmentsPageInfo", "assignmentsExportButton",
  "assignmentsKpiTotal", "assignmentsKpiArticles", "assignmentsKpiZones", "assignmentsKpiLast", "assignmentDetailModal",
  "assignmentDetailArticle", "assignmentDetailDescription", "assignmentDetailStore", "assignmentDetailZone", "assignmentDetailLayout",
  "assignmentDetailEan", "assignmentDetailSource", "assignmentDetailUser", "assignmentDetailDate", "assignmentDetailClose",
  "systemPage", "systemRefreshButton", "systemExportButton", "systemApiStatus", "systemApiVersion", "systemDbStatus", "systemDbSize",
  "systemIntegrity", "systemServerTime", "systemFrontendVersion", "systemBackendVersion", "systemPythonVersion", "systemFastApiVersion",
  "systemSqliteVersion", "systemPlatform", "systemDbPath", "systemDbBytes", "systemDbModified", "systemJournalMode",
  "systemForeignKeys", "systemCountsBody"
];

const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
let currentStore = null;
let storesCache = [];
let refreshTimer = null;
let currentSection = "dashboard";
let loadingDashboard = false;
let catalogOffset = 0;
let catalogTotal = 0;
let assignmentsOffset = 0;
let assignmentsTotal = 0;
let assignmentsCache = [];
let layoutEditor = emptyLayoutEditor();

initialize();

function emptyLayoutEditor() {
  return { layoutId: null, image: null, zones: [], selectedZoneId: null, drawing: false, start: null, nextZoneNumber: 1, mode: "draw" };
}
function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

async function initialize() {
  initializeShell({ version: FRONTEND_VERSION, onNavigate: showSection });
  if (elements.frontendVersion) elements.frontendVersion.textContent = FRONTEND_VERSION;
  bindEvents();
  try {
    const health = await fetchJson("/api/health");
    setApiStatus(true, `API ${health.version || "online"}`);
    setServiceState(elements.apiServiceDot, elements.apiServiceText, true, `Online · ${health.version || ""}`);
    setServiceState(elements.databaseDot, elements.databaseText, true, "Disponibile");
    await loadStores();
    startAutoRefresh();
  } catch (error) {
    setApiStatus(false, "API non disponibile");
    setServiceState(elements.apiServiceDot, elements.apiServiceText, false, "Non disponibile");
    setServiceState(elements.databaseDot, elements.databaseText, false, "Non verificabile");
    setOverallStatus(false, "Sistema non disponibile");
    showToast(error.message, "error");
  }
}

function bindEvents() {
  on(elements.storeSelect, "change", async event => { currentStore = event.target.value; await loadDashboard(); showSection(currentSection); });
  on(elements.refreshButton, "click", async () => { try { await loadStores(); showToast("Dati aggiornati.", "success"); } catch (error) { showToast(error.message, "error"); } });
  on(elements.catalogForm, "submit", importCatalog);
  on(elements.layoutForm, "submit", uploadLegacyLayout);
  on(elements.articleSearch, "input", debounce(loadArticles, 300));
  on(elements.newStoreButton, "click", resetStoreForm);
  on(elements.cancelStoreButton, "click", resetStoreForm);
  on(elements.storeForm, "submit", saveStore);
  on(elements.storeSearch, "input", renderStoreTable);
  on(elements.catalogSearch, "input", debounce(() => { catalogOffset = 0; loadCatalogPage(); }, 250));
  on(elements.catalogStatus, "change", () => { catalogOffset = 0; loadCatalogPage(); });
  on(elements.catalogSort, "change", () => { catalogOffset = 0; loadCatalogPage(); });
  on(elements.catalogPageSize, "change", () => { catalogOffset = 0; loadCatalogPage(); });
  on(elements.catalogRefreshButton, "click", loadCatalogPage);
  on(elements.catalogPrev, "click", () => { catalogOffset = Math.max(0, catalogOffset - Number(elements.catalogPageSize.value || 25)); loadCatalogPage(); });
  on(elements.catalogNext, "click", () => { catalogOffset += Number(elements.catalogPageSize.value || 25); loadCatalogPage(); });
  on(elements.drawerClose, "click", closeArticleDrawer);
  on(elements.drawerBackdrop, "click", closeArticleDrawer);
  on(elements.layoutRefreshButton, "click", loadLayoutsPage);
  on(elements.newLayoutButton, "click", startNewLayout);
  on(elements.cancelLayoutEdit, "click", closeLayoutEditor);
  on(elements.closeLayoutPreview, "click", () => { elements.layoutPreviewPanel.hidden = true; });
  on(elements.layoutEditorForm, "submit", saveLayoutFromEditor);
  on(elements.saveAndActivateLayout, "click", () => saveLayoutFromEditor(null, true));
  on(elements.layoutImageInput, "change", loadLayoutImage);
  on(elements.newZoneButton, "click", () => setEditorMode("draw"));
  on(elements.deleteZoneButton, "click", deleteSelectedZone);
  on(elements.clearZonesButton, "click", clearZones);
  bindCanvasEvents();
  window.addEventListener("resize", debounce(() => { syncLayoutOverlay(); renderEditorZones(); }, 100));
  on(elements.layoutCanvas, "scroll", () => syncLayoutOverlay());
  on(elements.assignmentsRefreshButton, "click", loadAssignmentsPage);
  on(elements.assignmentsExportButton, "click", exportAssignments);
  on(elements.assignmentsSearch, "input", debounce(() => { assignmentsOffset = 0; loadAssignmentsPage(); }, 250));
  on(elements.assignmentsZone, "change", () => { assignmentsOffset = 0; loadAssignmentsPage(); });
  on(elements.assignmentsLayout, "change", () => { assignmentsOffset = 0; loadAssignmentsPage(); });
  on(elements.assignmentsPageSize, "change", () => { assignmentsOffset = 0; loadAssignmentsPage(); });
  on(elements.assignmentsPrev, "click", () => { assignmentsOffset = Math.max(0, assignmentsOffset - Number(elements.assignmentsPageSize.value || 25)); loadAssignmentsPage(); });
  on(elements.assignmentsNext, "click", () => { assignmentsOffset += Number(elements.assignmentsPageSize.value || 25); loadAssignmentsPage(); });
  on(elements.assignmentDetailClose, "click", closeAssignmentDetail);
  on(elements.assignmentDetailModal, "click", event => { if (event.target === elements.assignmentDetailModal) closeAssignmentDetail(); });
  on(elements.systemRefreshButton, "click", loadSystemPage);
  on(elements.systemExportButton, "click", exportSystemDiagnostics);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && currentStore) loadDashboard({ silent: true }); });
}

function startAutoRefresh() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => { if (!document.hidden && currentStore) loadDashboard({ silent: true }); }, AUTO_REFRESH_MS);
}

async function loadStores() {
  const stores = await fetchJson("/api/admin/stores");
  storesCache = stores || [];
  renderStoreTable();
  const activeStores = storesCache.filter(store => store.active);
  const previousStore = currentStore;
  if (elements.storeCount) elements.storeCount.textContent = storesCache.length.toLocaleString("it-IT");
  if (elements.storeSelect) elements.storeSelect.innerHTML = "";
  if (!activeStores.length) {
    currentStore = null;
    if (elements.emptyState) elements.emptyState.hidden = false;
    if (elements.dashboard) elements.dashboard.hidden = true;
    if (elements.storeSelect) elements.storeSelect.disabled = true;
    return;
  }
  elements.storeSelect.disabled = false;
  activeStores.forEach(store => {
    const option = document.createElement("option");
    option.value = store.storeCode;
    option.textContent = `${store.storeCode} - ${store.storeName}`;
    elements.storeSelect.appendChild(option);
  });
  currentStore = activeStores.some(store => store.storeCode === previousStore) ? previousStore : activeStores[0].storeCode;
  elements.storeSelect.value = currentStore;
  if (elements.emptyState) elements.emptyState.hidden = true;
  if (elements.dashboard) elements.dashboard.hidden = currentSection !== "dashboard";
  await loadDashboard();
  showSection(currentSection);
}

async function loadDashboard({ silent = false } = {}) {
  if (!currentStore || loadingDashboard) return;
  loadingDashboard = true;
  if (elements.refreshButton) { elements.refreshButton.disabled = true; elements.refreshButton.textContent = "Aggiornamento..."; }
  try {
    const [summary] = await Promise.all([
      fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/summary`),
      loadArticles(),
      loadAssignments()
    ]);
    renderSummary(summary);
    setApiStatus(true, "API online");
    setServiceState(elements.apiServiceDot, elements.apiServiceText, true, "Online");
    setServiceState(elements.databaseDot, elements.databaseText, true, "Disponibile");
    setOverallStatus(true, "Sistema operativo");
  } catch (error) {
    setApiStatus(false, "Errore aggiornamento");
    setOverallStatus(false, "Verifica necessaria");
    if (!silent) showToast(error.message, "error");
  } finally {
    loadingDashboard = false;
    if (elements.refreshButton) { elements.refreshButton.disabled = false; elements.refreshButton.textContent = "Aggiorna ora"; }
  }
}

function renderSummary(summary) {
  const articles = Number(summary?.catalog?.articleCount || 0);
  const barcodes = Number(summary?.catalog?.barcodeCount || 0);
  const assignments = Number(summary?.assignmentCount || 0);
  const activeLayouts = summary?.activeLayouts || (summary?.layout ? [summary.layout] : []);
  const zoneTotal = activeLayouts.reduce((sum, item) => sum + Number(item.zoneCount || 0), 0);
  const coverage = articles > 0 ? Math.min(100, Math.round((assignments / articles) * 100)) : 0;
  const selectedStore = storesCache.find(store => store.storeCode === currentStore);
  if (elements.dashboardStoreName) elements.dashboardStoreName.textContent = selectedStore ? `${selectedStore.storeCode} · ${selectedStore.storeName}` : currentStore;
  if (elements.articleCount) elements.articleCount.textContent = articles.toLocaleString("it-IT");
  if (elements.barcodeCount) elements.barcodeCount.textContent = barcodes.toLocaleString("it-IT");
  if (elements.assignmentCount) elements.assignmentCount.textContent = assignments.toLocaleString("it-IT");
  if (elements.coveragePercent) elements.coveragePercent.textContent = `${coverage}%`;
  if (elements.coverageDetail) elements.coverageDetail.textContent = `${assignments.toLocaleString("it-IT")} di ${articles.toLocaleString("it-IT")} articoli`;
  if (elements.coverageBar) elements.coverageBar.style.width = `${coverage}%`;
  if (elements.zoneCount) elements.zoneCount.textContent = zoneTotal.toLocaleString("it-IT");
  if (activeLayouts.length) {
    if (elements.layoutCode) elements.layoutCode.textContent = `${activeLayouts.length} layout attivi`;
    if (elements.lastLayoutUpdate) elements.lastLayoutUpdate.textContent = activeLayouts.map(l => l.layoutName || l.layoutCode).join(" · ");
    setServiceState(elements.layoutDot, elements.layoutText, true, `${activeLayouts.length} attivi · ${zoneTotal} zone`);
  } else {
    if (elements.layoutCode) elements.layoutCode.textContent = "nessun layout";
    if (elements.lastLayoutUpdate) elements.lastLayoutUpdate.textContent = "Nessun layout pubblicato";
    setServiceState(elements.layoutDot, elements.layoutText, false, "Assente");
  }
  if (summary?.lastImport && elements.lastImport) elements.lastImport.textContent = `${formatDate(summary.lastImport.imported_at)} · ${summary.lastImport.rows_imported} EAN importati`;
  else if (elements.lastImport) elements.lastImport.textContent = "Nessun import registrato";
  setServiceState(elements.catalogDot, elements.catalogText, articles > 0, articles > 0 ? `${articles.toLocaleString("it-IT")} articoli` : "Vuoto");
  const timestamp = new Date().toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" });
  if (elements.lastRefresh) elements.lastRefresh.textContent = `Ultimo aggiornamento: ${timestamp}`;
  if (elements.lastDashboardUpdate) elements.lastDashboardUpdate.textContent = timestamp;
  if (elements.autoRefreshStatus) elements.autoRefreshStatus.textContent = "Aggiornamento automatico ogni 30 secondi";
}

async function importCatalog(event) {
  event.preventDefault();
  const file = elements.csvFile.files[0];
  if (!file) return showMessage(elements.catalogMessage, "Seleziona un CSV.", "error");
  showMessage(elements.catalogMessage, "Importazione in corso...", "");
  try {
    const result = await postFile(`/api/import/articles?replaceStoreCatalog=${elements.replaceCatalog.checked}`, file);
    currentStore = result.storeCode;
    const message = `${result.rowsImported} EAN importati, ${result.distinctArticles} articoli, ${result.rowsRejected} scarti.`;
    showMessage(elements.catalogMessage, message, result.rowsRejected ? "warning" : "success");
    showToast(message, result.rowsRejected ? "warning" : "success");
    elements.catalogForm.reset();
    elements.replaceCatalog.checked = true;
    await loadStores();
  } catch (error) {
    showMessage(elements.catalogMessage, error.message, "error");
    showToast(error.message, "error");
  }
}

async function uploadLegacyLayout(event) {
  event.preventDefault();
  const file = elements.layoutFile.files[0];
  if (!file) return showMessage(elements.layoutMessage, "Seleziona un JSON.", "error");
  showMessage(elements.layoutMessage, "Pubblicazione in corso...", "");
  try {
    const result = await postFile("/api/admin/layouts", file);
    currentStore = result.storeCode;
    const label = result.layoutName || result.layoutCode || result.layoutId;
    showMessage(elements.layoutMessage, `${label} pubblicato con ${result.zoneCount} zone.`, "success");
    showToast("Layout pubblicato.", "success");
    elements.layoutForm.reset();
    await loadStores();
  } catch (error) {
    showMessage(elements.layoutMessage, error.message, "error");
    showToast(error.message, "error");
  }
}

async function loadArticles() {
  if (!currentStore || !elements.articleTableBody) return;
  const search = elements.articleSearch?.value?.trim() || "";
  const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/articles?search=${encodeURIComponent(search)}&limit=100`);
  const items = result.items || [];
  elements.articleTableBody.innerHTML = items.map(article =>
    `<tr><td><strong>${escapeHtml(article.articleCode)}</strong></td><td>${escapeHtml(article.description || "-")}</td><td>${Number(article.barcodeCount || 0).toLocaleString("it-IT")}</td></tr>`
  ).join("");
  if (elements.articleEmpty) elements.articleEmpty.hidden = items.length > 0;
}

async function loadAssignments() {
  if (!currentStore || !elements.assignmentTableBody) return;
  const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/assignments`);
  const assignments = Array.isArray(result) ? result : (result.items || []);
  elements.assignmentTableBody.innerHTML = assignments.slice(0, 100).map(assignment =>
    `<tr><td><strong>${escapeHtml(assignment.zoneCode || "-")}</strong></td><td>${escapeHtml(assignment.articleCode || "-")}</td><td>${escapeHtml(assignment.description || "-")}</td><td>${formatDate(assignment.updatedAt)}</td></tr>`
  ).join("");
  if (elements.assignmentEmpty) elements.assignmentEmpty.hidden = assignments.length > 0;
}

function setApiStatus(ok, text) {
  if (!elements.apiDot || !elements.apiStatus) return;
  elements.apiDot.classList.toggle("ok", ok);
  elements.apiDot.classList.toggle("error", !ok);
  elements.apiStatus.textContent = text;
}
function setServiceState(dot, text, ok, label) {
  if (!dot || !text) return;
  dot.classList.toggle("ok", ok);
  dot.classList.toggle("error", !ok);
  text.textContent = label;
}
function setOverallStatus(ok, text) {
  if (!elements.overallStatus) return;
  elements.overallStatus.className = `health-badge ${ok ? "ok" : "error"}`;
  elements.overallStatus.textContent = text;
}
function showMessage(element, text, type) {
  if (!element) return;
  element.hidden = false;
  element.textContent = text;
  element.className = `message ${type}`.trim();
}

function showSection(section) {
  currentSection = section;
  const dashboardVisible = section === "dashboard";
  if (elements.dashboard) elements.dashboard.hidden = !dashboardVisible || !currentStore;
  if (elements.emptyState) elements.emptyState.hidden = !dashboardVisible || Boolean(currentStore);
  if (elements.storesPage) elements.storesPage.hidden = section !== "stores";
  if (elements.catalogPage) elements.catalogPage.hidden = section !== "catalog";
  if (elements.layoutsPage) elements.layoutsPage.hidden = section !== "layouts";
  if (elements.assignmentsPage) elements.assignmentsPage.hidden = section !== "assignments";
  if (elements.systemPage) elements.systemPage.hidden = section !== "system";
  const labels = {
    dashboard: ["Dashboard", "Stato operativo e sintesi dei dati ZoneMind"],
    stores: ["Negozi", "Anagrafica e stato dei punti vendita"],
    catalog: ["Catalogo", "Ricerca, filtri e dettaglio degli articoli del negozio"],
    layouts: ["Layout", "Creazione, editor e attivazione multipla dei layout del negozio"],
    assignments: ["Associazioni", "Consultazione in sola lettura della mappatura articolo-zona"],
    system: ["Sistema", "Stato tecnico, versioni e diagnostica dell'applicazione"]
  };
  if (elements.pageTitle) elements.pageTitle.textContent = labels[section]?.[0] || "ZoneMind";
  if (elements.pageSubtitle) elements.pageSubtitle.textContent = labels[section]?.[1] || "Admin Console";
  if (section === "stores") renderStoreTable();
  if (section === "catalog") loadCatalogPage();
  if (section === "layouts") loadLayoutsPage();
  if (section === "assignments") loadAssignmentsPage();
  if (section === "system") loadSystemPage();
}

async function loadSystemPage() {
  if (!elements.systemPage || currentSection !== "system") return;
  elements.systemRefreshButton.disabled = true;
  elements.systemRefreshButton.textContent = "Aggiornamento...";
  try {
    const data = await fetchJson("/api/admin/system");
    elements.systemApiStatus.textContent = data.api.status === "ok" ? "Online" : "Errore";
    elements.systemApiVersion.textContent = `API ${data.api.version}`;
    elements.systemDbStatus.textContent = data.database.available ? "Disponibile" : "Non disponibile";
    elements.systemDbSize.textContent = data.database.sizeHuman;
    elements.systemIntegrity.textContent = data.database.integrity === "ok" ? "OK" : data.database.integrity;
    elements.systemServerTime.textContent = formatDate(data.serverTime);
    elements.systemBackendVersion.textContent = data.api.version;
    elements.systemPythonVersion.textContent = data.runtime.python;
    elements.systemFastApiVersion.textContent = data.runtime.fastapi;
    elements.systemSqliteVersion.textContent = data.runtime.sqlite;
    elements.systemPlatform.textContent = data.runtime.platform;
    elements.systemDbPath.textContent = data.database.path;
    elements.systemDbBytes.textContent = `${Number(data.database.sizeBytes || 0).toLocaleString("it-IT")} byte (${data.database.sizeHuman})`;
    elements.systemDbModified.textContent = formatDate(data.database.modifiedAt);
    elements.systemJournalMode.textContent = data.database.journalMode || "-";
    elements.systemForeignKeys.textContent = data.database.foreignKeys ? "Attive" : "Non attive";
    elements.systemCountsBody.innerHTML = (data.counts || []).map(item =>
      `<tr><td><strong>${escapeHtml(item.label)}</strong></td><td>${escapeHtml(item.table)}</td><td>${Number(item.count).toLocaleString("it-IT")}</td></tr>`
    ).join("");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    elements.systemRefreshButton.disabled = false;
    elements.systemRefreshButton.textContent = "Aggiorna";
  }
}
function exportSystemDiagnostics() { window.location.href = "/api/admin/system/diagnostics"; }

function renderStoreTable() {
  if (!elements.storeTableBody) return;
  const query = (elements.storeSearch?.value || "").trim().toLowerCase();
  const rows = storesCache.filter(store => [store.storeCode, store.storeName, store.city, store.countryCode].join(" ").toLowerCase().includes(query));
  elements.storeTableBody.innerHTML = rows.map(store =>
    `<tr class="store-row" data-store-code="${escapeHtml(store.storeCode)}"><td><strong>${escapeHtml(store.storeCode)}</strong></td><td>${escapeHtml(store.storeName || "")}</td><td>${escapeHtml(store.city || "-")}</td><td>${escapeHtml(store.countryCode || "-")}</td><td>${Number(store.articleCount || 0).toLocaleString("it-IT")}</td><td>${Number(store.assignmentCount || 0).toLocaleString("it-IT")}</td><td><span class="status-pill ${store.active ? "active" : "inactive"}">${store.active ? "Attivo" : "Disattivo"}</span></td>
<td>
  ${
    store.storeCode.startsWith("STORE")
      ? `
        <button
          class="danger-button delete-store"
          type="button"
          data-store-code="${escapeHtml(store.storeCode)}">
          Elimina
        </button>
      `
      : ""
  }
</td>
	</tr>`
  ).join("");
  if (elements.storeEmpty) elements.storeEmpty.hidden = rows.length > 0;
  elements.storeTableBody.querySelectorAll(".store-row").forEach(row => row.addEventListener("click", () => editStore(row.dataset.storeCode)));
  elements.storeTableBody.querySelectorAll(".delete-store").forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    deleteStore(button.dataset.storeCode);
  }));
}
function resetStoreForm() {
  elements.storeForm.reset();
  elements.storeActiveInput.checked = true;
  elements.storeCodeInput.disabled = false;
  elements.storeForm.dataset.mode = "create";
  elements.storeFormTitle.textContent = "Nuovo negozio";
  if (elements.storeMessage) elements.storeMessage.hidden = true;
}
function editStore(code) {
  const store = storesCache.find(item => item.storeCode === code);
  if (!store) return;
  elements.storeForm.dataset.mode = "edit";
  elements.storeFormTitle.textContent = `Modifica ${store.storeCode}`;
  elements.storeCodeInput.value = store.storeCode;
  elements.storeCodeInput.disabled = true;
  elements.storeNameInput.value = store.storeName || "";
  elements.storeCityInput.value = store.city || "";
  elements.storeCountryInput.value = store.countryCode || "";
  elements.storeActiveInput.checked = Boolean(store.active);
  if (elements.storeMessage) elements.storeMessage.hidden = true;
}
async function saveStore(event) {
  event.preventDefault();
  const mode = elements.storeForm.dataset.mode || "create";
  const code = elements.storeCodeInput.value.trim().toUpperCase();
  const payload = { storeCode: code, storeName: elements.storeNameInput.value.trim(), city: elements.storeCityInput.value.trim() || null, countryCode: elements.storeCountryInput.value.trim().toUpperCase() || null, active: elements.storeActiveInput.checked };
  try {
    await fetchJson(mode === "edit" ? `/api/admin/stores/${encodeURIComponent(code)}` : "/api/admin/stores", {
      method: mode === "edit" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    showMessage(elements.storeMessage, mode === "edit" ? "Negozio aggiornato." : "Negozio creato.", "success");
    showToast(mode === "edit" ? "Negozio aggiornato." : "Negozio creato.", "success");
    await loadStores();
    if (mode === "create") resetStoreForm();
  } catch (error) {
    showMessage(elements.storeMessage, error.message, "error");
    showToast(error.message, "error");
  }
}

async function deleteStore(storeCode) {
  const code = String(storeCode || "").trim().toUpperCase();
  if (!code) return;
  const store = storesCache.find(item => item.storeCode === code);
  const label = store ? `${store.storeCode} - ${store.storeName || ""}`.trim() : code;
  const confirmed = window.confirm(`Eliminare il negozio ${label}?\n\nSaranno rimossi anche catalogo, layout, associazioni e import collegati al negozio.`);
  if (!confirmed) return;
  try {
    await fetchJson(`/api/admin/stores/${encodeURIComponent(code)}`, { method: "DELETE" });
    showToast("Negozio eliminato.", "success");
    showMessage(elements.storeMessage, "Negozio eliminato.", "success");
    if (currentStore === code) currentStore = null;
    resetStoreForm();
    await loadStores();
  } catch (error) {
    showToast(error.message, "error");
    showMessage(elements.storeMessage, error.message, "error");
  }
}

async function loadCatalogPage() {
  if (!currentStore || currentSection !== "catalog" || !elements.catalogTableBody) return;
  const limit = Number(elements.catalogPageSize.value || 25);
  const [sortBy, sortDir] = elements.catalogSort.value.split(":");
  const params = new URLSearchParams({ search: elements.catalogSearch.value.trim(), mappingStatus: elements.catalogStatus.value, sortBy, sortDir, limit: String(limit), offset: String(catalogOffset) });
  try {
    const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/articles?${params}`);
    catalogTotal = Number(result.total || 0);
    if (catalogOffset >= catalogTotal && catalogTotal > 0) { catalogOffset = Math.max(0, catalogTotal - limit); return loadCatalogPage(); }
    renderCatalogRows(result.items || [], limit);
  } catch (error) { showToast(error.message, "error"); }
}
function renderCatalogRows(items, limit) {
  elements.catalogTableBody.innerHTML = items.map(article =>
    `<tr><td><strong>${escapeHtml(article.articleCode)}</strong></td><td>${escapeHtml(article.description || "-")}</td><td>${Number(article.barcodeCount || 0).toLocaleString("it-IT")}</td><td>${escapeHtml(article.zoneCode || "-")}</td><td><span class="status-pill ${article.mappingStatus}">${article.mappingStatus === "mapped" ? "Mappato" : "Non mappato"}</span></td><td><button class="detail-button" type="button" data-article="${escapeHtml(article.articleCode)}" title="Apri dettaglio">›</button></td></tr>`
  ).join("");
  elements.catalogEmpty.hidden = items.length > 0;
  const first = catalogTotal ? catalogOffset + 1 : 0;
  const last = Math.min(catalogOffset + items.length, catalogTotal);
  elements.catalogResultTitle.textContent = `${catalogTotal.toLocaleString("it-IT")} articoli`;
  elements.catalogResultInfo.textContent = `${currentStore} · risultati ${first}-${last}`;
  const page = Math.floor(catalogOffset / limit) + 1;
  const pages = Math.max(1, Math.ceil(catalogTotal / limit));
  elements.catalogPageInfo.textContent = `Pagina ${page} di ${pages}`;
  elements.catalogPrev.disabled = catalogOffset === 0;
  elements.catalogNext.disabled = catalogOffset + limit >= catalogTotal;
  elements.catalogTableBody.querySelectorAll("button[data-article]").forEach(button => button.addEventListener("click", () => openArticleDrawer(button.dataset.article)));
}
async function openArticleDrawer(articleCode) {
  try {
    const detail = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/articles/${encodeURIComponent(articleCode)}`);
    elements.drawerArticleCode.textContent = detail.articleCode;
    elements.drawerDescription.textContent = detail.description || "Nessuna descrizione";
    elements.drawerStore.textContent = detail.storeCode;
    elements.drawerZone.textContent = detail.zoneCode || "Non mappato";
    elements.drawerStatus.textContent = detail.zoneCode ? "Mappato" : "Non mappato";
    elements.drawerUpdated.textContent = detail.assignmentUpdatedAt ? formatDate(detail.assignmentUpdatedAt) : "-";
    elements.drawerBarcodes.innerHTML = (detail.barcodes || []).length ? detail.barcodes.map(item =>
      `<div class="barcode-item"><strong>${escapeHtml(item.ean)}</strong><span>${escapeHtml([item.colorCode, item.sizeCode].filter(Boolean).join(" · ") || "")}</span></div>`
    ).join("") : '<div class="table-empty">Nessun barcode disponibile.</div>';
    elements.articleDrawer.hidden = false;
    elements.drawerBackdrop.hidden = false;
  } catch (error) { showToast(error.message, "error"); }
}
function closeArticleDrawer() { if (elements.articleDrawer) elements.articleDrawer.hidden = true; if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = true; }

// ---------------- Layout editor ----------------
async function loadLayoutsPage() {
  if (!currentStore || currentSection !== "layouts") return;
  try {
    const layouts = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/layouts`);
    renderLayouts(layouts || []);
  } catch (error) { showToast(error.message, "error"); }
}
function renderLayouts(layouts) {
  const active = layouts.filter(item => item.active);
  if (elements.activeLayoutsStrip) {
    elements.activeLayoutsStrip.innerHTML = active.length
      ? active.map(item => `<span class="active-layout-chip">${escapeHtml(item.layoutName || item.layoutCode)} · ${Number(item.zoneCount || 0)} zone</span>`).join("")
      : "<span>Nessun layout attivo</span>";
  }
  elements.layoutTableBody.innerHTML = layouts.map(item =>
    `<tr><td><strong>${escapeHtml(item.layoutName || item.layoutCode || "-")}</strong><small>${escapeHtml(item.description || item.layoutId)}</small></td><td>${Number(item.zoneCount || 0)}</td><td>${escapeHtml(item.imageName || "-")}</td><td>${formatDate(item.updatedAt)}</td><td><label class="switch"><input type="checkbox" class="layout-active-toggle" data-id="${escapeHtml(item.layoutId)}" ${item.active ? "checked" : ""}><span></span></label></td><td>
	<div class="row-actions">

  <button
    class="ghost-button edit-layout"
    data-id="${escapeHtml(item.layoutId)}"
    type="button">
    Modifica
  </button>

  <button
    class="ghost-button preview-layout"
    data-id="${escapeHtml(item.layoutId)}"
    type="button">
    Zone
  </button>

  <a
    class="button-link"
    href="/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(item.layoutId)}/download">
    Scarica
  </a>

  <button
    class="danger-button delete-layout"
    data-id="${escapeHtml(item.layoutId)}"
    ${item.active ? "disabled" : ""}
    type="button">
    Elimina
  </button>

</div>
</td></tr>`
  ).join("");
  elements.layoutTableEmpty.hidden = layouts.length > 0;
  elements.layoutTableBody.querySelectorAll(".edit-layout").forEach(button => button.addEventListener("click", () => editLayout(button.dataset.id)));
  elements.layoutTableBody.querySelectorAll(".preview-layout").forEach(button => button.addEventListener("click", () => previewLayout(button.dataset.id)));
elements.layoutTableBody
  .querySelectorAll(".delete-layout")
  .forEach(button =>
    button.addEventListener(
      "click",
      () => deleteLayout(button.dataset.id)
    )
  );  
  elements.layoutTableBody.querySelectorAll(".layout-active-toggle").forEach(input => input.addEventListener("change", () => toggleLayoutActive(input.dataset.id, input.checked)));
}
function setCanvasEmptyVisible(visible) {
  if (!elements.layoutCanvasEmpty) return;
  elements.layoutCanvasEmpty.hidden = !visible;
  elements.layoutCanvasEmpty.style.display = visible ? "grid" : "none";
}
function syncLayoutOverlay() {
  const img = elements.layoutImagePreview;
  const svg = elements.layoutSvg;
  const canvas = elements.layoutCanvas;
  if (!img || !svg || !canvas || !img.getAttribute("src") || img.style.display === "none") return;
  const imgRect = img.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const left = imgRect.left - canvasRect.left + canvas.scrollLeft;
  const top = imgRect.top - canvasRect.top + canvas.scrollTop;
  svg.style.position = "absolute";
  svg.style.inset = "auto";
  svg.style.left = `${left}px`;
  svg.style.top = `${top}px`;
  svg.style.width = `${imgRect.width}px`;
  svg.style.height = `${imgRect.height}px`;
  svg.style.display = "block";
  svg.style.pointerEvents = "auto";
}
function setPreviewImage(image) {
  const source = image?.dataUrl || image?.dataURL || image?.src || image?.url || "";
  if (!source || !elements.layoutImagePreview) {
    setCanvasEmptyVisible(true);
    return false;
  }
  layoutEditor.image = { ...image, dataUrl: source };
  elements.layoutImagePreview.onload = () => {
    layoutEditor.image.width = layoutEditor.image.width || elements.layoutImagePreview.naturalWidth || 1000;
    layoutEditor.image.height = layoutEditor.image.height || elements.layoutImagePreview.naturalHeight || 700;
    elements.layoutImagePreview.style.display = "block";
    setCanvasEmptyVisible(false);
    syncLayoutOverlay();
    renderEditorZones();
  };
  elements.layoutImagePreview.onerror = () => {
    setCanvasEmptyVisible(true);
    showToast("Impossibile visualizzare la planimetria salvata.", "error");
  };
  elements.layoutImagePreview.src = source;
  if (elements.layoutImagePreview.complete && elements.layoutImagePreview.naturalWidth > 0) {
    elements.layoutImagePreview.onload();
  }
  return true;
}
function startNewLayout() {
  resetLayoutEditor();
  elements.layoutEditorPanel.hidden = false;
  elements.layoutEditorTitle.textContent = "Nuovo layout";
  elements.layoutNameInput.focus();
}
function resetLayoutEditor() {
  layoutEditor = emptyLayoutEditor();
  if (elements.layoutEditorForm) elements.layoutEditorForm.reset();
  if (elements.layoutIdInput) elements.layoutIdInput.value = "";
  if (elements.layoutEditorMessage) elements.layoutEditorMessage.hidden = true;
  if (elements.layoutImagePreview) {
    elements.layoutImagePreview.onload = null;
    elements.layoutImagePreview.onerror = null;
    elements.layoutImagePreview.removeAttribute("src");
    elements.layoutImagePreview.style.display = "none";
  }
  if (elements.layoutSvg) {
    elements.layoutSvg.innerHTML = "";
    elements.layoutSvg.style.display = "none";
  }
  setCanvasEmptyVisible(true);
  renderEditorZones();
}
function closeLayoutEditor() { elements.layoutEditorPanel.hidden = true; }
function setEditorMode(mode) { layoutEditor.mode = mode; elements.layoutCanvas?.classList.toggle("is-drawing", mode === "draw"); }
async function editLayout(layoutId) {
  try {
    const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(layoutId)}`);
    const layout = result.layout || {};
    resetLayoutEditor();
    layoutEditor.layoutId = layout.layoutId || layoutId;
    layoutEditor.zones = normalizeZones(Array.isArray(layout.zones) ? layout.zones : []);
    layoutEditor.nextZoneNumber = getNextZoneNumber(layoutEditor.zones);
    elements.layoutIdInput.value = layoutEditor.layoutId;
    elements.layoutNameInput.value = layout.layoutName || layout.layoutCode || "";
    elements.layoutDescriptionInput.value = layout.description || "";
    elements.layoutEditorTitle.textContent = `Modifica ${layout.layoutName || layout.layoutCode || layoutId}`;
    elements.layoutEditorPanel.hidden = false;
    const imageLoaded = setPreviewImage(layout.image);
    if (!imageLoaded) renderEditorZones();
    elements.layoutEditorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { showToast(error.message, "error"); }
}
function normalizeZones(zones) {
  return zones.map((zone, index) => {
    const geometry = zone.geometry || {};
    const code = zone.code || zone.zoneCode || `A${String(index + 1).padStart(2, "0")}`;
    return {
      ...zone,
      id: zone.id || zone.zoneId || `zone-${index + 1}`,
      code,
      zoneCode: zone.zoneCode || code,
      name: zone.name || code,
      geometry: {
        type: geometry.type || zone.geometryType || "rect",
        x: Number(geometry.x || 0),
        y: Number(geometry.y || 0),
        width: Number(geometry.width || 0),
        height: Number(geometry.height || 0)
      }
    };
  });
}
function loadLayoutImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    const img = new Image();
    img.onload = () => setPreviewImage({ name: file.name, type: file.type, dataUrl, width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}
function bindCanvasEvents() {
  on(elements.layoutSvg, "mousedown", startDrawZone);
  on(elements.layoutSvg, "mousemove", moveDrawZone);
  window.addEventListener("mouseup", endDrawZone);
}
function layoutViewBox() {
  const w = Number(layoutEditor.image?.width || elements.layoutImagePreview?.naturalWidth || 1000);
  const h = Number(layoutEditor.image?.height || elements.layoutImagePreview?.naturalHeight || 700);
  return { w, h };
}
function pointerPoint(event) {
  const img = elements.layoutImagePreview;
  if (!img || !img.getAttribute("src")) return { x: 0, y: 0, inside: false };
  const rect = img.getBoundingClientRect();
  const vb = layoutViewBox();
  const rx = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const ry = (event.clientY - rect.top) / Math.max(rect.height, 1);
  const inside = rx >= 0 && rx <= 1 && ry >= 0 && ry <= 1;
  return {
    x: Math.max(0, Math.min(vb.w, rx * vb.w)),
    y: Math.max(0, Math.min(vb.h, ry * vb.h)),
    inside
  };
}
function startDrawZone(event) {
  if (!layoutEditor.image || layoutEditor.mode !== "draw" || event.target.classList.contains("zone-rect")) return;
  syncLayoutOverlay();
  const start = pointerPoint(event);
  if (!start.inside) return;
  layoutEditor.drawing = true;
  layoutEditor.start = start;
  const code = `A${String(layoutEditor.nextZoneNumber++).padStart(2, "0")}`;
  const zone = { id: `zone-${Date.now()}`, code, zoneCode: code, name: code, geometry: { type: "rect", x: start.x, y: start.y, width: 1, height: 1 } };
  layoutEditor.zones.push(zone);
  layoutEditor.selectedZoneId = zone.id;
  renderEditorZones();
}
function moveDrawZone(event) {
  if (!layoutEditor.drawing || !layoutEditor.selectedZoneId) return;
  const point = pointerPoint(event);
  const zone = layoutEditor.zones.find(z => z.id === layoutEditor.selectedZoneId);
  if (!zone) return;
  const x = Math.min(layoutEditor.start.x, point.x);
  const y = Math.min(layoutEditor.start.y, point.y);
  zone.geometry.x = x;
  zone.geometry.y = y;
  zone.geometry.width = Math.abs(point.x - layoutEditor.start.x);
  zone.geometry.height = Math.abs(point.y - layoutEditor.start.y);
  renderEditorZones();
}
function endDrawZone() {
  if (!layoutEditor.drawing) return;
  layoutEditor.drawing = false;
  const zone = layoutEditor.zones.find(z => z.id === layoutEditor.selectedZoneId);
  if (zone && (zone.geometry.width < 8 || zone.geometry.height < 8)) {
    layoutEditor.zones = layoutEditor.zones.filter(z => z.id !== zone.id);
    layoutEditor.selectedZoneId = null;
  }
  renderEditorZones();
}
function renderEditorZones() {
  if (!elements.layoutSvg) return;
  const vb = layoutViewBox();
  syncLayoutOverlay();
  elements.layoutSvg.setAttribute("viewBox", `0 0 ${vb.w} ${vb.h}`);
  elements.layoutSvg.setAttribute("preserveAspectRatio", "none");
  elements.layoutSvg.innerHTML = layoutEditor.zones.map(z => {
    const g = z.geometry || {};
    const selected = z.id === layoutEditor.selectedZoneId;
    const x = Number(g.x || 0);
    const y = Number(g.y || 0);
    const width = Number(g.width || 0);
    const height = Number(g.height || 0);
    return `<g class="editor-zone ${selected ? "selected" : ""}" data-id="${escapeHtml(z.id)}"><rect class="zone-rect" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"></rect><text x="${x + 8}" y="${y + 22}">${escapeHtml(z.code || z.zoneCode || "Zona")}</text></g>`;
  }).join("");
  elements.layoutSvg.querySelectorAll(".editor-zone").forEach(node => node.addEventListener("mousedown", event => {
    event.stopPropagation();
    layoutEditor.selectedZoneId = node.dataset.id;
    renderEditorZones();
  }));
  if (elements.layoutZoneCounter) elements.layoutZoneCounter.textContent = `Zone: ${layoutEditor.zones.length}`;
  if (elements.deleteZoneButton) elements.deleteZoneButton.disabled = !layoutEditor.selectedZoneId;
}
function getNextZoneNumber(zones) {
  const nums = zones.map(z => String(z.code || z.zoneCode || "").match(/^A(\d+)$/)?.[1]).filter(Boolean).map(Number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}
function deleteSelectedZone() {
  if (!layoutEditor.selectedZoneId) return;
  layoutEditor.zones = layoutEditor.zones.filter(z => z.id !== layoutEditor.selectedZoneId);
  layoutEditor.selectedZoneId = null;
  renderEditorZones();
}
function clearZones() {
  if (!layoutEditor.zones.length || window.confirm("Cancellare tutte le zone del layout corrente?")) {
    layoutEditor.zones = [];
    layoutEditor.selectedZoneId = null;
    layoutEditor.nextZoneNumber = 1;
    renderEditorZones();
  }
}
function buildLayoutPayload(active = false) {
  if (!currentStore) throw new Error("Seleziona un negozio.");
  if (!elements.layoutNameInput.value.trim()) throw new Error("Inserisci un nome layout.");
  if (!layoutEditor.image) throw new Error("Carica una planimetria.");
  return {
    layoutId: layoutEditor.layoutId || `LAYOUT-${currentStore}-${Date.now()}`,
    storeCode: currentStore,
    layoutCode: elements.layoutNameInput.value.trim(),
    layoutName: elements.layoutNameInput.value.trim(),
    description: elements.layoutDescriptionInput.value.trim() || null,
    active,
    image: layoutEditor.image,
    zones: layoutEditor.zones.map((z, index) => ({
      id: z.id || `zone-${index + 1}`,
      zoneId: z.zoneId || z.id || `zone-${index + 1}`,
      code: z.code || z.zoneCode || `A${String(index + 1).padStart(2, "0")}`,
      zoneCode: z.zoneCode || z.code || `A${String(index + 1).padStart(2, "0")}`,
      name: z.name || z.code || z.zoneCode || `Zona ${index + 1}`,
      geometryType: "RECTANGLE",
      geometry: z.geometry
    }))
  };
}
async function saveLayoutFromEditor(event, activate = false) {
  if (event?.preventDefault) event.preventDefault();
  try {
    const payload = buildLayoutPayload(activate);
    const method = layoutEditor.layoutId ? "PUT" : "POST";
    const url = layoutEditor.layoutId
      ? `/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(layoutEditor.layoutId)}`
      : `/api/admin/stores/${encodeURIComponent(currentStore)}/layouts`;
    const result = await fetchJson(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    showMessage(elements.layoutEditorMessage, `${result.layoutName || result.layoutCode} salvato con ${result.zoneCount} zone${activate ? " e attivato" : ""}.`, "success");
    showToast("Layout salvato.", "success");
    layoutEditor.layoutId = result.layoutId;
    elements.layoutIdInput.value = result.layoutId;
    await loadLayoutsPage();
    await loadDashboard({ silent: true });
  } catch (error) {
    showMessage(elements.layoutEditorMessage, error.message, "error");
    showToast(error.message, "error");
  }
}
async function toggleLayoutActive(layoutId, active) {
  try {
    await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(layoutId)}/active`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active })
    });
    showToast(active ? "Layout attivato." : "Layout disattivato.", "success");
    await loadLayoutsPage();
    await loadDashboard({ silent: true });
  } catch (error) {
    showToast(error.message, "error");
    await loadLayoutsPage();
  }
}
async function deleteLayout(layoutId) {

  const confirmed = window.confirm(
    "Eliminare il layout selezionato?"
  );

  if (!confirmed) {
    return;
  }

  try {

    await fetchJson(
      `/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(layoutId)}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "Layout eliminato.",
      "success"
    );

    await loadLayoutsPage();
    await loadDashboard({ silent: true });

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }
}
async function previewLayout(layoutId) {
  try {
    const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(layoutId)}`);
    const layout = result.layout || {};
    elements.layoutPreviewTitle.textContent = `${layout.layoutName || layout.layoutCode || layoutId}`;
    const zones = Array.isArray(layout.zones) ? layout.zones : [];
    elements.layoutZonePreview.innerHTML = zones.length ? zones.map(z => `<span class="zone-chip">${escapeHtml(z.code || z.zoneCode || z.zoneId || z.id || "Zona")}</span>`).join("") : '<span class="table-empty">Nessuna zona.</span>';
    elements.layoutPreviewPanel.hidden = false;
    elements.layoutPreviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { showToast(error.message, "error"); }
}

async function loadAssignmentsPage() {
  if (!currentStore || currentSection !== "assignments") return;
  const limit = Number(elements.assignmentsPageSize.value || 25);
  const params = new URLSearchParams({ search: elements.assignmentsSearch.value.trim(), zoneCode: elements.assignmentsZone.value || "all", layoutId: elements.assignmentsLayout.value || "active", limit: String(limit), offset: String(assignmentsOffset) });
  try {
    const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/assignments?${params}`);
    assignmentsTotal = Number(result.total || 0);
    assignmentsCache = result.items || [];
    elements.assignmentsKpiTotal.textContent = assignmentsTotal.toLocaleString("it-IT");
    elements.assignmentsKpiArticles.textContent = Number(result.articleCount || 0).toLocaleString("it-IT");
    elements.assignmentsKpiZones.textContent = Number(result.zoneCount || 0).toLocaleString("it-IT");
    elements.assignmentsKpiLast.textContent = result.lastMapping ? formatDate(result.lastMapping) : "-";
    fillAssignmentFilters(result.zones || [], result.layouts || []);
    renderAssignmentRows(assignmentsCache, limit);
  } catch (error) { showToast(error.message, "error"); }
}
function fillAssignmentFilters(zones, layouts) {
  const zoneValue = elements.assignmentsZone.value || "all";
  elements.assignmentsZone.innerHTML = '<option value="all">Tutte</option>' + zones.map(z => `<option value="${escapeHtml(z.zoneCode)}">${escapeHtml(z.zoneCode)}</option>`).join("");
  if ([...elements.assignmentsZone.options].some(option => option.value === zoneValue)) elements.assignmentsZone.value = zoneValue;
  const layoutValue = elements.assignmentsLayout.value || "active";
  elements.assignmentsLayout.innerHTML = '<option value="active">Layout attivi</option><option value="all">Tutti i layout</option>' + layouts.map(layout => `<option value="${escapeHtml(layout.layoutId)}">${escapeHtml(layout.layoutCode)}${layout.active ? " · attivo" : ""}</option>`).join("");
  if ([...elements.assignmentsLayout.options].some(option => option.value === layoutValue)) elements.assignmentsLayout.value = layoutValue;
}
function renderAssignmentRows(items, limit) {
  elements.assignmentsManagementBody.innerHTML = items.map((item, index) =>
    `<tr class="clickable-row" data-index="${index}"><td><strong>${escapeHtml(item.zoneCode || "-")}</strong></td><td>${escapeHtml(item.articleCode || "-")}</td><td>${escapeHtml(item.description || "-")}</td><td>${escapeHtml(item.scannedEan || "-")}</td><td>${escapeHtml(item.layoutCode || item.layoutId || "-")}</td><td><span class="source-badge">${escapeHtml(item.source || "SCANNER")}</span></td><td>${formatDate(item.updatedAt)}</td></tr>`
  ).join("");
  elements.assignmentsManagementEmpty.hidden = items.length > 0;
  const first = assignmentsTotal ? assignmentsOffset + 1 : 0;
  const last = Math.min(assignmentsOffset + items.length, assignmentsTotal);
  elements.assignmentsResultTitle.textContent = `${assignmentsTotal.toLocaleString("it-IT")} associazioni`;
  elements.assignmentsResultInfo.textContent = `${currentStore} · risultati ${first}-${last} · sola lettura`;
  const page = Math.floor(assignmentsOffset / limit) + 1;
  const pages = Math.max(1, Math.ceil(assignmentsTotal / limit));
  elements.assignmentsPageInfo.textContent = `Pagina ${page} di ${pages}`;
  elements.assignmentsPrev.disabled = assignmentsOffset === 0;
  elements.assignmentsNext.disabled = assignmentsOffset + limit >= assignmentsTotal;
  elements.assignmentsManagementBody.querySelectorAll(".clickable-row").forEach(row => row.addEventListener("click", () => openAssignmentDetail(assignmentsCache[Number(row.dataset.index)])));
}
function openAssignmentDetail(item) {
  elements.assignmentDetailArticle.textContent = item.articleCode || "-";
  elements.assignmentDetailDescription.textContent = item.description || "Nessuna descrizione";
  elements.assignmentDetailStore.textContent = currentStore || "-";
  elements.assignmentDetailZone.textContent = item.zoneCode || "-";
  elements.assignmentDetailLayout.textContent = item.layoutCode || item.layoutId || "-";
  elements.assignmentDetailEan.textContent = item.scannedEan || "-";
  elements.assignmentDetailSource.textContent = item.source || "SCANNER";
  elements.assignmentDetailUser.textContent = item.createdBy || "Non disponibile";
  elements.assignmentDetailDate.textContent = item.updatedAt ? formatDate(item.updatedAt) : "-";
  elements.assignmentDetailModal.hidden = false;
}
function closeAssignmentDetail() { if (elements.assignmentDetailModal) elements.assignmentDetailModal.hidden = true; }
function exportAssignments() {
  if (!currentStore) return;
  const layoutId = encodeURIComponent(elements.assignmentsLayout.value || "active");
  window.location.href = `/api/admin/stores/${encodeURIComponent(currentStore)}/assignments/export?layoutId=${layoutId}`;
}
