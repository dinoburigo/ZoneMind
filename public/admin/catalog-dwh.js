function escapeValue(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("it-IT");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
  return payload;
}

function ensureCatalogDwhPanel() {
  if (document.getElementById("catalogDwhPanel")) return;

  const catalogPage = document.getElementById("catalogPage");
  if (!catalogPage) return;

  const filterPanel = catalogPage.querySelector(".catalog-filter-panel");
  const panel = document.createElement("article");
  panel.id = "catalogDwhPanel";
  panel.className = "panel";
  panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <span class="section-kicker" title="Indica che il catalogo viene alimentato dal DWH e salvato nel database SQLite locale di ZoneMind.">DWH → SQLite</span>
        <h2>Caricamento catalogo SKU/EAN</h2>
        <p>
          Carica la vista <strong>V_ZONEMIND_ARTICLES</strong> nel database SQLite operativo di ZoneMind.
          Il catalogo alimenta la ricerca articoli e il futuro Mapper offline.
        </p>
        <p id="catalogDwhSourceInfo" class="muted-text" title="Informazioni sull'origine dati e sull'ultimo aggiornamento disponibile nel database SQLite.">
          Origine dati: V_ZONEMIND_ARTICLES · Ultimo caricamento: —
        </p>
      </div>
      <div class="row-actions">
        <button
          id="catalogDwhSync"
          type="button"
          title="Aggiorna il catalogo SQLite caricando dal DWH solo le informazioni nuove o modificate. Utilizzare per l'aggiornamento quotidiano.">
          Aggiorna catalogo
        </button>
        <button
          id="catalogDwhFull"
          type="button"
          class="ghost-button"
          title="Cancella e ricostruisce completamente il catalogo articoli leggendo tutti i dati dalla vista V_ZONEMIND_ARTICLES. Utilizzare solo per primo caricamento o manutenzione straordinaria.">
          Ricarica completa
        </button>
        <button
          id="catalogDwhStatus"
          type="button"
          class="ghost-button"
          title="Ricarica contatori, metriche e storico delle sincronizzazioni senza modificare i dati del catalogo.">
          Aggiorna statistiche
        </button>
      </div>
    </div>
    <div class="card-grid">
      <article class="metric-card" title="Numero totale di record presenti nella tabella tecnica zm_articles.">
        <div class="metric-top"><span>Righe SQLite</span></div>
        <strong id="catalogDwhRows">—</strong>
        <small>record in zm_articles</small>
      </article>
      <article class="metric-card" title="Numero di stagioni presenti nel catalogo caricato dal DWH.">
        <div class="metric-top"><span>Stagioni</span></div>
        <strong id="catalogDwhSeasons">—</strong>
        <small>stagioni distinte</small>
      </article>
      <article class="metric-card" title="Numero di negozi caricati nel catalogo SQLite.">
        <div class="metric-top"><span>Negozi</span></div>
        <strong id="catalogDwhStores">—</strong>
        <small>negozi caricati</small>
      </article>
      <article class="metric-card" title="Numero di articoli distinti disponibili per la mappatura.">
        <div class="metric-top"><span>Articoli</span></div>
        <strong id="catalogDwhArticles">—</strong>
        <small>articoli distinti</small>
      </article>
      <article class="metric-card" title="Numero totale di codici EAN presenti nel catalogo SQLite.">
        <div class="metric-top"><span>EAN</span></div>
        <strong id="catalogDwhEans">—</strong>
        <small>barcode disponibili</small>
      </article>
    </div>
    <div id="catalogDwhMessage" class="message" hidden></div>
    <div id="catalogDwhLog" class="table-wrapper" hidden style="margin-top: 16px;"></div>
  `;

  if (filterPanel) catalogPage.insertBefore(panel, filterPanel);
  else catalogPage.appendChild(panel);

  document.getElementById("catalogDwhSync").addEventListener("click", () => executeCatalogDwhLoad("sync"));
  document.getElementById("catalogDwhFull").addEventListener("click", () => executeCatalogDwhLoad("full"));
  document.getElementById("catalogDwhStatus").addEventListener("click", refreshCatalogDwhStatus);

  refreshCatalogDwhStatus();
}

function setCatalogDwhBusy(busy) {
  ["catalogDwhSync", "catalogDwhFull", "catalogDwhStatus"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.disabled = busy;
  });
}

function showCatalogDwhMessage(text, type = "") {
  const message = document.getElementById("catalogDwhMessage");
  if (!message) return;
  message.hidden = false;
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function renderCatalogDwhStatus(payload) {
  const catalog = payload.catalog || {};

  document.getElementById("catalogDwhRows").textContent = formatNumber(catalog.rows);
  document.getElementById("catalogDwhSeasons").textContent = formatNumber(catalog.seasons);
  document.getElementById("catalogDwhStores").textContent = formatNumber(catalog.stores);
  document.getElementById("catalogDwhArticles").textContent = formatNumber(catalog.articles);
  document.getElementById("catalogDwhEans").textContent = formatNumber(catalog.eans);

  const sourceInfo = document.getElementById("catalogDwhSourceInfo");
  if (sourceInfo) {
    sourceInfo.textContent = `Origine dati: V_ZONEMIND_ARTICLES · Ultimo caricamento: ${formatDate(catalog.lastUpdate)}`;
  }

  const runs = catalog.runs || [];
  const log = document.getElementById("catalogDwhLog");
  if (!log) return;

  if (!runs.length) {
    log.hidden = true;
    log.innerHTML = "";
    return;
  }

  log.hidden = false;
  log.innerHTML = `
    <table>
      <thead>
        <tr>
          <th title="Identificativo progressivo del caricamento.">ID</th>
          <th title="Tipo di caricamento eseguito: FULL, SYNC o caricamento per negozio.">Tipo</th>
          <th title="Data e ora di inizio del caricamento.">Inizio</th>
          <th title="Data e ora di fine del caricamento.">Fine</th>
          <th title="Numero di righe lette dalla vista DWH e processate in SQLite.">Righe</th>
          <th title="Numero di righe scartate durante il caricamento.">Scarti</th>
          <th title="Esito tecnico del caricamento.">Stato</th>
          <th title="Messaggio restituito dal processo di caricamento.">Messaggio</th>
        </tr>
      </thead>
      <tbody>${runs.map(run => `
        <tr>
          <td>${escapeValue(run.sync_id)}</td>
          <td>${escapeValue(run.sync_type)}</td>
          <td>${escapeValue(formatDate(run.started_at))}</td>
          <td>${escapeValue(formatDate(run.ended_at))}</td>
          <td>${escapeValue(formatNumber(run.rows_read))}</td>
          <td>${escapeValue(formatNumber(run.rows_rejected))}</td>
          <td>${escapeValue(run.status)}</td>
          <td>${escapeValue(run.message || "")}</td>
        </tr>`).join("")}</tbody>
    </table>
  `;
}

async function refreshCatalogDwhStatus() {
  ensureCatalogDwhPanel();
  setCatalogDwhBusy(true);
  try {
    const payload = await fetchJson("/api/admin/catalog/dwh/status");
    renderCatalogDwhStatus(payload);
    showCatalogDwhMessage("Stato catalogo DWH aggiornato.", "success");
  } catch (error) {
    showCatalogDwhMessage(error.message, "error");
  } finally {
    setCatalogDwhBusy(false);
  }
}

async function executeCatalogDwhLoad(type) {
  const full = type === "full";
  if (full && !window.confirm("Eseguire la ricarica completa del catalogo SQLite? Usare solo per primo caricamento o manutenzione straordinaria.")) return;

  setCatalogDwhBusy(true);
  showCatalogDwhMessage(full ? "Ricarica completa in corso..." : "Aggiornamento catalogo in corso...");

  try {
    const payload = await fetchJson(`/api/admin/catalog/dwh/${type}`, { method: "POST" });
    renderCatalogDwhStatus(payload);
    showCatalogDwhMessage(
      `${full ? "Ricarica completa" : "Aggiornamento catalogo"} completato. Righe lette: ${formatNumber(payload.rowsRead)}.`,
      "success"
    );

    const refreshButton = document.getElementById("catalogRefreshButton");
    if (refreshButton) refreshButton.click();
  } catch (error) {
    showCatalogDwhMessage(error.message, "error");
  } finally {
    setCatalogDwhBusy(false);
  }
}

const observer = new MutationObserver(() => {
  const catalogPage = document.getElementById("catalogPage");
  if (catalogPage && !catalogPage.hidden) ensureCatalogDwhPanel();
});
observer.observe(document.body, { attributes: true, childList: true, subtree: true });

window.addEventListener("DOMContentLoaded", () => {
  const catalogPage = document.getElementById("catalogPage");
  if (catalogPage && !catalogPage.hidden) ensureCatalogDwhPanel();
});
