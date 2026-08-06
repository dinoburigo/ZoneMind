function storeEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function storeNumber(value) {
  return Number(value || 0).toLocaleString("it-IT");
}

function storeDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" });
}

async function storeFetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
  return payload;
}

function ensureStoreDwhPanel() {
  if (document.getElementById("storeDwhPanel")) return;
  const storesPage = document.getElementById("storesPage");
  if (!storesPage) return;

  const dashboardHeading = storesPage.querySelector(".dashboard-heading");
  const panel = document.createElement("article");
  panel.id = "storeDwhPanel";
  panel.className = "panel";
  panel.style.marginBottom = "16px";
  panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <span class="section-kicker" title="Indica che l'anagrafica negozi viene alimentata dal DWH e salvata in SQLite locale.">DWH → SQLite</span>
        <h2>Caricamento anagrafica negozi</h2>
        <p>
          Carica la vista <strong>V_ZONEMIND_STORES</strong> nel database SQLite operativo di ZoneMind.
          La creazione manuale resta disponibile per negozi di test.
        </p>
        <p id="storeDwhSourceInfo" class="muted-text" title="Informazioni sull'origine dati e sull'ultimo aggiornamento disponibile nel database SQLite.">
          Origine dati: V_ZONEMIND_STORES · Ultimo caricamento: —
        </p>
      </div>
      <div class="row-actions">
        <button
          id="storeDwhSync"
          type="button"
          title="Aggiorna l'anagrafica negozi SQLite caricando dal DWH solo le informazioni nuove o modificate. Utilizzare per l'aggiornamento ordinario.">
          Aggiorna negozi
        </button>
        <button
          id="storeDwhFull"
          type="button"
          class="ghost-button"
          title="Ricostruisce la tabella tecnica dei negozi DWH e aggiorna l'anagrafica negozi operativa. I negozi manuali di test non vengono cancellati.">
          Ricarica completa
        </button>
        <button
          id="storeDwhStatus"
          type="button"
          class="ghost-button"
          title="Ricarica contatori, metriche e storico delle sincronizzazioni senza modificare i dati dei negozi.">
          Aggiorna statistiche
        </button>
      </div>
    </div>
    <div class="card-grid">
      <article class="metric-card" title="Numero totale di righe presenti nella tabella tecnica zm_stores.">
        <div class="metric-top"><span>Righe SQLite</span></div>
        <strong id="storeDwhRows">—</strong>
        <small>record in zm_stores</small>
      </article>
      <article class="metric-card" title="Numero di negozi distinti caricati dalla vista V_ZONEMIND_STORES.">
        <div class="metric-top"><span>Negozi</span></div>
        <strong id="storeDwhStores">—</strong>
        <small>negozi distinti</small>
      </article>
      <article class="metric-card" title="Numero di città distinte presenti nell'anagrafica negozi caricata dal DWH.">
        <div class="metric-top"><span>Città</span></div>
        <strong id="storeDwhCities">—</strong>
        <small>città distinte</small>
      </article>
      <article class="metric-card" title="Numero di nazioni distinte presenti nell'anagrafica negozi caricata dal DWH.">
        <div class="metric-top"><span>Nazioni</span></div>
        <strong id="storeDwhCountries">—</strong>
        <small>nazioni distinte</small>
      </article>
    </div>
    <div id="storeDwhMessage" class="message" hidden></div>
    <div id="storeDwhLog" class="table-wrapper" hidden style="margin-top: 16px;"></div>
  `;

  if (dashboardHeading && dashboardHeading.parentNode) {
    dashboardHeading.insertAdjacentElement("afterend", panel);
  } else {
    storesPage.prepend(panel);
  }

  document.getElementById("storeDwhSync").addEventListener("click", () => executeStoreDwhLoad("sync"));
  document.getElementById("storeDwhFull").addEventListener("click", () => executeStoreDwhLoad("full"));
  document.getElementById("storeDwhStatus").addEventListener("click", refreshStoreDwhStatus);

  refreshStoreDwhStatus();
}

function setStoreDwhBusy(busy) {
  ["storeDwhSync", "storeDwhFull", "storeDwhStatus"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.disabled = busy;
  });
}

function showStoreDwhMessage(text, type = "") {
  const message = document.getElementById("storeDwhMessage");
  if (!message) return;
  message.hidden = false;
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function renderStoreDwhStatus(payload) {
  const stores = payload.stores || {};
  document.getElementById("storeDwhRows").textContent = storeNumber(stores.rows);
  document.getElementById("storeDwhStores").textContent = storeNumber(stores.stores);
  document.getElementById("storeDwhCities").textContent = storeNumber(stores.cities);
  document.getElementById("storeDwhCountries").textContent = storeNumber(stores.countries);

  const sourceInfo = document.getElementById("storeDwhSourceInfo");
  if (sourceInfo) {
    sourceInfo.textContent = `Origine dati: V_ZONEMIND_STORES · Ultimo caricamento: ${storeDate(stores.lastUpdate)}`;
  }

  const log = document.getElementById("storeDwhLog");
  const runs = stores.runs || [];
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
          <th title="Tipo di caricamento eseguito.">Tipo</th>
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
          <td>${storeEscape(run.sync_id)}</td>
          <td>${storeEscape(run.sync_type)}</td>
          <td>${storeEscape(storeDate(run.started_at))}</td>
          <td>${storeEscape(storeDate(run.ended_at))}</td>
          <td>${storeEscape(storeNumber(run.rows_read))}</td>
          <td>${storeEscape(storeNumber(run.rows_rejected))}</td>
          <td>${storeEscape(run.status)}</td>
          <td>${storeEscape(run.message || "")}</td>
        </tr>`).join("")}</tbody>
    </table>
  `;
}

async function refreshStoreDwhStatus() {
  ensureStoreDwhPanel();
  setStoreDwhBusy(true);
  try {
    const payload = await storeFetchJson("/api/admin/stores/dwh/status");
    renderStoreDwhStatus(payload);
    showStoreDwhMessage("Stato anagrafica negozi aggiornato.", "success");
  } catch (error) {
    showStoreDwhMessage(error.message, "error");
  } finally {
    setStoreDwhBusy(false);
  }
}

async function executeStoreDwhLoad(type) {
  const full = type === "full";
  if (full && !window.confirm("Eseguire la ricarica completa dell'anagrafica negozi? I negozi manuali di test non verranno cancellati.")) return;
  setStoreDwhBusy(true);
  showStoreDwhMessage(full ? "Ricarica completa negozi in corso..." : "Aggiornamento negozi in corso...");
  try {
    const payload = await storeFetchJson(`/api/admin/stores/dwh/${type}`, { method: "POST" });
    renderStoreDwhStatus(payload);
    showStoreDwhMessage(`${full ? "Ricarica completa" : "Aggiornamento negozi"} completato. Righe lette: ${storeNumber(payload.rowsRead)}.`, "success");
    const refreshButton = document.getElementById("refreshButton");
    if (refreshButton) refreshButton.click();
  } catch (error) {
    showStoreDwhMessage(error.message, "error");
  } finally {
    setStoreDwhBusy(false);
  }
}

function observeStorePageVisibility() {
  const storesPage = document.getElementById("storesPage");
  if (storesPage && !storesPage.hidden) ensureStoreDwhPanel();
}

const storeDwhObserver = new MutationObserver(observeStorePageVisibility);
storeDwhObserver.observe(document.body, { attributes: true, childList: true, subtree: true });

window.addEventListener("DOMContentLoaded", observeStorePageVisibility);
window.addEventListener("load", observeStorePageVisibility);

// Esposizione diagnostica utile da console browser.
window.ZoneMindStoresDwh = {
  ensurePanel: ensureStoreDwhPanel,
  refreshStatus: refreshStoreDwhStatus
};
