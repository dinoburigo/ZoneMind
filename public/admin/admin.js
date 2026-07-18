import { fetchJson, postFile } from "../assets/js/components/api-client.js";
import { debounce, escapeHtml, formatDate } from "../assets/js/components/formatters.js";
import { initializeShell } from "../assets/js/components/app-shell.js";
import { showToast } from "../assets/js/components/toast.js";

const AUTO_REFRESH_MS = 30000;

const elements = Object.fromEntries([
  "apiDot", "apiStatus", "autoRefreshStatus", "storeSelect", "refreshButton", "emptyState", "dashboard",
  "dashboardStoreName", "lastRefresh", "overallStatus", "articleCount", "barcodeCount", "zoneCount",
  "layoutCode", "assignmentCount", "coveragePercent", "coverageDetail", "coverageBar", "storeCount",
  "apiServiceDot", "apiServiceText", "databaseDot", "databaseText", "catalogDot", "catalogText",
  "layoutDot", "layoutText", "lastImport", "lastLayoutUpdate", "lastDashboardUpdate", "catalogForm",
  "csvFile", "replaceCatalog", "catalogMessage", "layoutForm", "layoutFile", "layoutMessage",
  "articleSearch", "articleTableBody", "articleEmpty", "assignmentTableBody", "assignmentEmpty",
  "pageTitle", "pageSubtitle", "storesPage", "newStoreButton", "storeForm", "storeFormTitle",
  "storeCodeInput", "storeNameInput", "storeCityInput", "storeCountryInput", "storeActiveInput",
  "cancelStoreButton", "storeMessage", "storeSearch", "storeTableBody", "storeEmpty",
  "catalogPage", "catalogRefreshButton", "catalogSearch", "catalogStatus", "catalogSort", "catalogPageSize",
  "catalogResultTitle", "catalogResultInfo", "catalogTableBody", "catalogEmpty", "catalogPrev", "catalogNext",
  "catalogPageInfo", "articleDrawer", "drawerBackdrop", "drawerClose", "drawerArticleCode", "drawerDescription",
  "drawerStore", "drawerZone", "drawerStatus", "drawerUpdated", "drawerBarcodes",
  "layoutsPage", "layoutRefreshButton", "layoutManagementForm", "layoutManagementFile", "layoutManagementMessage",
  "activeLayoutName", "activeLayoutMeta", "activeLayoutZones", "activeLayoutAssignments", "layoutTableBody",
  "layoutTableEmpty", "layoutPreviewPanel", "layoutPreviewTitle", "layoutZonePreview", "closeLayoutPreview"
].map(id => [id, document.getElementById(id)]));

let currentStore = null;
let storesCache = [];
let refreshTimer = null;
let loadingDashboard = false;
let currentSection = "dashboard";
let catalogOffset = 0;
let catalogTotal = 0;

initialize();

async function initialize() {
  initializeShell({ version: "0.8.5", onNavigate: showSection });
  bindEvents();

  try {
    const health = await fetchJson("/api/health");
    setApiStatus(true, `API ${health.version}`);
    setServiceState(elements.apiServiceDot, elements.apiServiceText, true, `Online · ${health.version}`);
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
  elements.storeSelect.addEventListener("change", async event => {
    currentStore = event.target.value;
    await loadDashboard();
  });

  elements.refreshButton.addEventListener("click", async () => {
    try {
      await loadStores();
      showToast("Dashboard aggiornata.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  elements.catalogForm.addEventListener("submit", importCatalog);
  elements.layoutForm.addEventListener("submit", uploadLayout);
  elements.articleSearch.addEventListener("input", debounce(loadArticles, 300));
  elements.newStoreButton.addEventListener("click", resetStoreForm);
  elements.cancelStoreButton.addEventListener("click", resetStoreForm);
  elements.storeForm.addEventListener("submit", saveStore);
  elements.storeSearch.addEventListener("input", renderStoreTable);
  elements.catalogSearch.addEventListener("input", debounce(() => { catalogOffset = 0; loadCatalogPage(); }, 250));
  elements.catalogStatus.addEventListener("change", () => { catalogOffset = 0; loadCatalogPage(); });
  elements.catalogSort.addEventListener("change", () => { catalogOffset = 0; loadCatalogPage(); });
  elements.catalogPageSize.addEventListener("change", () => { catalogOffset = 0; loadCatalogPage(); });
  elements.catalogRefreshButton.addEventListener("click", loadCatalogPage);
  elements.catalogPrev.addEventListener("click", () => { catalogOffset = Math.max(0, catalogOffset - Number(elements.catalogPageSize.value)); loadCatalogPage(); });
  elements.catalogNext.addEventListener("click", () => { catalogOffset += Number(elements.catalogPageSize.value); loadCatalogPage(); });
  elements.drawerClose.addEventListener("click", closeArticleDrawer);
  elements.drawerBackdrop.addEventListener("click", closeArticleDrawer);
  elements.layoutRefreshButton.addEventListener("click", loadLayoutsPage);
  elements.layoutManagementForm.addEventListener("submit", uploadManagedLayout);
  elements.closeLayoutPreview.addEventListener("click", () => elements.layoutPreviewPanel.hidden = true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && currentStore) loadDashboard({ silent: true });
  });
}

function startAutoRefresh() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (!document.hidden && currentStore) loadDashboard({ silent: true });
  }, AUTO_REFRESH_MS);
}

async function loadStores() {
  const stores = await fetchJson("/api/admin/stores");
  storesCache = stores;
  renderStoreTable();
  const activeStores = stores.filter(store => store.active);
  const previousStore = currentStore;
  elements.storeCount.textContent = stores.length;
  elements.storeSelect.innerHTML = "";

  if (activeStores.length === 0) {
    currentStore = null;
    elements.emptyState.hidden = false;
    elements.dashboard.hidden = true;
    elements.storeSelect.disabled = true;
    return;
  }

  elements.storeSelect.disabled = false;
  activeStores.forEach(store => {
    const option = document.createElement("option");
    option.value = store.storeCode;
    option.textContent = `${store.storeCode} - ${store.storeName}`;
    elements.storeSelect.appendChild(option);
  });

  currentStore = activeStores.some(store => store.storeCode === previousStore)
    ? previousStore
    : activeStores[0].storeCode;

  elements.storeSelect.value = currentStore;
  elements.emptyState.hidden = true;
  elements.dashboard.hidden = false;
  await loadDashboard();
  showSection(currentSection);
}

async function loadDashboard({ silent = false } = {}) {
  if (!currentStore || loadingDashboard) return;
  loadingDashboard = true;
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Aggiornamento...";

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
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "Aggiorna ora";
  }
}

function renderSummary(summary) {
  const articles = Number(summary.catalog.articleCount || 0);
  const barcodes = Number(summary.catalog.barcodeCount || 0);
  const assignments = Number(summary.assignmentCount || 0);
  const coverage = articles > 0 ? Math.min(100, Math.round((assignments / articles) * 100)) : 0;
  const selectedStore = storesCache.find(store => store.storeCode === currentStore);
  const now = new Date();

  elements.dashboardStoreName.textContent = selectedStore
    ? `${selectedStore.storeCode} · ${selectedStore.storeName}`
    : summary.storeCode;
  elements.articleCount.textContent = articles.toLocaleString("it-IT");
  elements.barcodeCount.textContent = barcodes.toLocaleString("it-IT");
  elements.assignmentCount.textContent = assignments.toLocaleString("it-IT");
  elements.coveragePercent.textContent = `${coverage}%`;
  elements.coverageDetail.textContent = `${assignments.toLocaleString("it-IT")} di ${articles.toLocaleString("it-IT")} articoli`;
  elements.coverageBar.style.width = `${coverage}%`;
  elements.storeCount.textContent = storesCache.length.toLocaleString("it-IT");

  if (summary.layout) {
    elements.zoneCount.textContent = Number(summary.layout.zoneCount || 0).toLocaleString("it-IT");
    elements.layoutCode.textContent = summary.layout.layoutCode;
    elements.lastLayoutUpdate.textContent = `${summary.layout.layoutCode} · ${formatDate(summary.layout.updatedAt)}`;
    setServiceState(elements.layoutDot, elements.layoutText, true, `${summary.layout.zoneCount} zone`);
  } else {
    elements.zoneCount.textContent = "0";
    elements.layoutCode.textContent = "nessun layout";
    elements.lastLayoutUpdate.textContent = "Nessun layout pubblicato";
    setServiceState(elements.layoutDot, elements.layoutText, false, "Assente");
  }

  if (summary.lastImport) {
    elements.lastImport.textContent = `${formatDate(summary.lastImport.imported_at)} · ${summary.lastImport.rows_imported} EAN importati`;
  } else {
    elements.lastImport.textContent = "Nessun import registrato";
  }

  setServiceState(
    elements.catalogDot,
    elements.catalogText,
    articles > 0,
    articles > 0 ? `${articles.toLocaleString("it-IT")} articoli` : "Vuoto"
  );

  const timestamp = now.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" });
  elements.lastRefresh.textContent = `Ultimo aggiornamento: ${timestamp}`;
  elements.lastDashboardUpdate.textContent = timestamp;
  elements.autoRefreshStatus.textContent = "Aggiornamento automatico ogni 30 secondi";
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

async function uploadLayout(event) {
  event.preventDefault();
  const file = elements.layoutFile.files[0];
  if (!file) return showMessage(elements.layoutMessage, "Seleziona un JSON.", "error");

  showMessage(elements.layoutMessage, "Pubblicazione in corso...", "");
  try {
    const result = await postFile("/api/admin/layouts", file);
    currentStore = result.storeCode;
    const message = `${result.layoutCode} pubblicato con ${result.zoneCount} zone.`;
    showMessage(elements.layoutMessage, message, "success");
    showToast(message, "success");
    elements.layoutForm.reset();
    await loadStores();
  } catch (error) {
    showMessage(elements.layoutMessage, error.message, "error");
    showToast(error.message, "error");
  }
}

async function loadArticles() {
  if (!currentStore) return;
  const search = elements.articleSearch.value.trim();
  const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/articles?search=${encodeURIComponent(search)}&limit=100`);
  elements.articleTableBody.innerHTML = "";
  elements.articleEmpty.hidden = result.items.length > 0;
  result.items.forEach(article => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><strong>${escapeHtml(article.articleCode)}</strong></td><td>${escapeHtml(article.description || "-")}</td><td>${article.barcodeCount}</td>`;
    elements.articleTableBody.appendChild(row);
  });
}

async function loadAssignments() {
  if (!currentStore) return;
  const assignments = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/assignments`);
  elements.assignmentTableBody.innerHTML = "";
  elements.assignmentEmpty.hidden = assignments.length > 0;
  assignments.forEach(assignment => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><strong>${escapeHtml(assignment.zoneCode)}</strong></td><td>${escapeHtml(assignment.articleCode)}</td><td>${escapeHtml(assignment.description || "-")}</td><td>${formatDate(assignment.updatedAt)}</td>`;
    elements.assignmentTableBody.appendChild(row);
  });
}

function setApiStatus(ok, text) {
  elements.apiDot.classList.toggle("ok", ok);
  elements.apiDot.classList.toggle("error", !ok);
  elements.apiStatus.textContent = text;
}

function setServiceState(dot, text, ok, label) {
  dot.classList.toggle("ok", ok);
  dot.classList.toggle("error", !ok);
  text.textContent = label;
}

function setOverallStatus(ok, text) {
  elements.overallStatus.className = `health-badge ${ok ? "ok" : "error"}`;
  elements.overallStatus.textContent = text;
}

function showMessage(element, text, type) {
  element.hidden = false;
  element.textContent = text;
  element.className = `message ${type}`.trim();
}


function showSection(section) {
  currentSection = section;
  const dashboardVisible = section === "dashboard";
  elements.dashboard.hidden = !dashboardVisible || !currentStore;
  elements.emptyState.hidden = !dashboardVisible || Boolean(currentStore);
  elements.storesPage.hidden = section !== "stores";
  elements.catalogPage.hidden = section !== "catalog";
  elements.layoutsPage.hidden = section !== "layouts";
  const labels = {
    dashboard: ["Dashboard", "Stato operativo e sintesi dei dati ZoneMind"],
    stores: ["Negozi", "Anagrafica e stato dei punti vendita"],
    catalog: ["Catalogo", "Ricerca, filtri e dettaglio degli articoli del negozio"],
    layouts: ["Layout", "Pubblicazione e storico delle planimetrie del negozio"]
  };
  elements.pageTitle.textContent = labels[section]?.[0] || "ZoneMind";
  elements.pageSubtitle.textContent = labels[section]?.[1] || "Admin Console";
  if (section === "stores") renderStoreTable();
  if (section === "catalog") loadCatalogPage();
  if (section === "layouts") loadLayoutsPage();
}

function renderStoreTable() {
  if (!elements.storeTableBody) return;
  const query = (elements.storeSearch?.value || "").trim().toLowerCase();
  const rows = storesCache.filter(store => {
    const text = [store.storeCode, store.storeName, store.city, store.countryCode].join(" ").toLowerCase();
    return !query || text.includes(query);
  });
  elements.storeTableBody.innerHTML = rows.map(store => `
    <tr class="store-row" data-store-code="${escapeHtml(store.storeCode)}">
      <td><strong>${escapeHtml(store.storeCode)}</strong></td>
      <td>${escapeHtml(store.storeName || "")}</td>
      <td>${escapeHtml(store.city || "—")}</td>
      <td>${escapeHtml(store.countryCode || "—")}</td>
      <td>${Number(store.articleCount || 0).toLocaleString("it-IT")}</td>
      <td>${Number(store.assignmentCount || 0).toLocaleString("it-IT")}</td>
      <td><span class="status-pill ${store.active ? "active" : "inactive"}">${store.active ? "Attivo" : "Disattivo"}</span></td>
    </tr>`).join("");
  elements.storeEmpty.hidden = rows.length > 0;
  elements.storeTableBody.querySelectorAll(".store-row").forEach(row => {
    row.addEventListener("click", () => editStore(row.dataset.storeCode));
  });
}

function resetStoreForm() {
  elements.storeForm.reset();
  elements.storeActiveInput.checked = true;
  elements.storeCodeInput.disabled = false;
  elements.storeForm.dataset.mode = "create";
  elements.storeFormTitle.textContent = "Nuovo negozio";
  elements.storeMessage.hidden = true;
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
  elements.storeMessage.hidden = true;
}

async function saveStore(event) {
  event.preventDefault();
  const mode = elements.storeForm.dataset.mode || "create";
  const code = elements.storeCodeInput.value.trim().toUpperCase();
  const payload = {
    storeCode: code,
    storeName: elements.storeNameInput.value.trim(),
    city: elements.storeCityInput.value.trim() || null,
    countryCode: elements.storeCountryInput.value.trim().toUpperCase() || null,
    active: elements.storeActiveInput.checked
  };
  try {
    await fetchJson(mode === "edit" ? `/api/admin/stores/${encodeURIComponent(code)}` : "/api/admin/stores", {
      method: mode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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


async function loadCatalogPage() {
  if (!currentStore || currentSection !== "catalog") return;
  const limit = Number(elements.catalogPageSize.value || 25);
  const [sortBy, sortDir] = elements.catalogSort.value.split(":");
  const params = new URLSearchParams({
    search: elements.catalogSearch.value.trim(),
    mappingStatus: elements.catalogStatus.value,
    sortBy, sortDir, limit: String(limit), offset: String(catalogOffset)
  });
  try {
    const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/articles?${params}`);
    catalogTotal = Number(result.total || 0);
    if (catalogOffset >= catalogTotal && catalogTotal > 0) { catalogOffset = Math.max(0, catalogTotal - limit); return loadCatalogPage(); }
    renderCatalogRows(result.items || [], limit);
  } catch (error) { showToast(error.message, "error"); }
}

function renderCatalogRows(items, limit) {
  elements.catalogTableBody.innerHTML = items.map(article => `
    <tr>
      <td><strong>${escapeHtml(article.articleCode)}</strong></td>
      <td>${escapeHtml(article.description || "—")}</td>
      <td>${Number(article.barcodeCount || 0).toLocaleString("it-IT")}</td>
      <td>${escapeHtml(article.zoneCode || "—")}</td>
      <td><span class="status-pill ${article.mappingStatus}">${article.mappingStatus === "mapped" ? "Mappato" : "Non mappato"}</span></td>
      <td><button class="detail-button" type="button" data-article="${escapeHtml(article.articleCode)}" title="Apri dettaglio">›</button></td>
    </tr>`).join("");
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
  elements.catalogTableBody.querySelectorAll("button[data-article]").forEach(button =>
    button.addEventListener("click", () => openArticleDrawer(button.dataset.article))
  );
}

async function openArticleDrawer(articleCode) {
  try {
    const detail = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/articles/${encodeURIComponent(articleCode)}`);
    elements.drawerArticleCode.textContent = detail.articleCode;
    elements.drawerDescription.textContent = detail.description || "Nessuna descrizione";
    elements.drawerStore.textContent = detail.storeCode;
    elements.drawerZone.textContent = detail.zoneCode || "Non mappato";
    elements.drawerStatus.textContent = detail.zoneCode ? "Mappato" : "Non mappato";
    elements.drawerUpdated.textContent = detail.assignmentUpdatedAt ? formatDate(detail.assignmentUpdatedAt) : "—";
    elements.drawerBarcodes.innerHTML = detail.barcodes.length ? detail.barcodes.map(item => `
      <div class="barcode-item"><strong>${escapeHtml(item.ean)}</strong><span>${escapeHtml([item.colorCode, item.sizeCode].filter(Boolean).join(" · ") || "")}</span></div>`).join("")
      : '<div class="table-empty">Nessun barcode disponibile.</div>';
    elements.articleDrawer.hidden = false;
    elements.drawerBackdrop.hidden = false;
  } catch (error) { showToast(error.message, "error"); }
}

function closeArticleDrawer() {
  elements.articleDrawer.hidden = true;
  elements.drawerBackdrop.hidden = true;
}


async function loadLayoutsPage() {
  if (!currentStore || currentSection !== "layouts") return;
  try {
    const layouts = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/layouts`);
    renderLayouts(layouts);
  } catch (error) { showToast(error.message, "error"); }
}

function renderLayouts(layouts) {
  const active = layouts.find(item => item.active);
  elements.activeLayoutName.textContent = active ? active.layoutCode : "Nessun layout";
  elements.activeLayoutMeta.textContent = active ? `${active.layoutId} · aggiornato ${formatDate(active.updatedAt)}` : "Pubblica un JSON esportato dall'Editor.";
  elements.activeLayoutZones.textContent = Number(active?.zoneCount || 0).toLocaleString("it-IT");
  elements.activeLayoutAssignments.textContent = Number(active?.assignmentCount || 0).toLocaleString("it-IT");
  elements.layoutTableBody.innerHTML = layouts.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.layoutCode || "—")}</strong></td><td>${escapeHtml(item.layoutId)}</td>
      <td>${Number(item.zoneCount || 0)}</td><td>${Number(item.assignmentCount || 0)}</td><td>${formatDate(item.updatedAt)}</td>
      <td><span class="status-pill ${item.active ? "active" : "inactive"}">${item.active ? "Attivo" : "Storico"}</span></td>
      <td><div class="row-actions"><button class="ghost-button preview-layout" data-id="${escapeHtml(item.layoutId)}" type="button">Visualizza</button><a class="button-link" href="/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(item.layoutId)}/download">Scarica</a>${item.active ? "" : `<button class="activate-layout" data-id="${escapeHtml(item.layoutId)}" type="button">Attiva</button>`}</div></td>
    </tr>`).join("");
  elements.layoutTableEmpty.hidden = layouts.length > 0;
  elements.layoutTableBody.querySelectorAll(".preview-layout").forEach(b => b.addEventListener("click", () => previewLayout(b.dataset.id)));
  elements.layoutTableBody.querySelectorAll(".activate-layout").forEach(b => b.addEventListener("click", () => activateLayout(b.dataset.id)));
}

async function uploadManagedLayout(event) {
  event.preventDefault();
  const file = elements.layoutManagementFile.files[0];
  if (!file) return showMessage(elements.layoutManagementMessage, "Seleziona un JSON.", "error");
  try {
    const result = await postFile("/api/admin/layouts", file);
    currentStore = result.storeCode;
    elements.storeSelect.value = currentStore;
    showMessage(elements.layoutManagementMessage, `${result.layoutCode} pubblicato con ${result.zoneCount} zone.`, "success");
    showToast("Layout pubblicato.", "success");
    elements.layoutManagementForm.reset();
    await loadStores();
    showSection("layouts");
  } catch (error) { showMessage(elements.layoutManagementMessage, error.message, "error"); }
}

async function previewLayout(layoutId) {
  try {
    const result = await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(layoutId)}`);
    const layout = result.layout;
    elements.layoutPreviewTitle.textContent = `${layout.layoutCode || layoutId} · ${layoutId}`;
    const zones = Array.isArray(layout.zones) ? layout.zones : [];
    elements.layoutZonePreview.innerHTML = zones.length ? zones.map(z => `<span class="zone-chip">${escapeHtml(z.code || z.zoneCode || z.id || "Zona")}</span>`).join("") : '<span class="table-empty">Nessuna zona.</span>';
    elements.layoutPreviewPanel.hidden = false;
    elements.layoutPreviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { showToast(error.message, "error"); }
}

async function activateLayout(layoutId) {
  if (!window.confirm("Riattivare questa versione del layout?")) return;
  try {
    await fetchJson(`/api/admin/stores/${encodeURIComponent(currentStore)}/layouts/${encodeURIComponent(layoutId)}/activate`, { method: "POST" });
    showToast("Layout attivato.", "success");
    await loadLayoutsPage();
    await loadDashboard({ silent: true });
  } catch (error) { showToast(error.message, "error"); }
}
