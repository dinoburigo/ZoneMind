const PANEL_ID = "catalogSqliteDwhPanel";

function zmEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function zmNumber(value) {
  return Number(value || 0).toLocaleString("it-IT");
}

function zmDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" });
}

function ensureDwhStyles() {
  if (document.getElementById("catalogSqliteDwhStyles")) return;
  const style = document.createElement("style");
  style.id = "catalogSqliteDwhStyles";
  style.textContent = `
    .sqlite-dwh-panel { border-color:#b9d7f2; background:linear-gradient(180deg,#fff,#f8fbff); margin-bottom:16px; }
    .sqlite-dwh-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end; }
    .sqlite-dwh-kpis { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:14px; }
    .sqlite-dwh-kpi { background:#f7f9fb; border:1px solid #e3e8ee; border-radius:10px; padding:10px 12px; display:grid; gap:4px; }
    .sqlite-dwh-kpi small { color:#65717d; font-size:12px; }
    .sqlite-dwh-kpi strong { font-size:19px; }
    .sqlite-dwh-message { margin-top:12px; padding:10px 12px; border-radius:8px; background:#edf2f6; color:#17212b; }
    .sqlite-dwh-message.ok { background:#e8f5e9; color:#1b5e20; }
    .sqlite-dwh-message.error { background:#ffebee; color:#b00020; }
    .sqlite-dwh-log { margin-top:14px; max-height:240px; overflow:auto; border:1px solid #e3e8ee; border-radius:10px; background:#fff; }
    .sqlite-dwh-log table { width:100%; border-collapse:collapse; }
    .sqlite-dwh-log th,.sqlite-dwh-log td { padding:8px 10px; border-bottom:1px solid #eef2f6; font-size:12px; text-align:left; }
    @media(max-width:920px){ .sqlite-dwh-kpis{grid-template-columns:repeat(2,minmax(0,1fr));} .sqlite-dwh-actions{justify-content:flex-start;} }
    @media(max-width:620px){ .sqlite-dwh-kpis{grid-template-columns:1fr;} }
  `;
  document.head.appendChild(style);
}

function ensureDwhPanel() {
  ensureDwhStyles();
  if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);
  const catalogPage = document.getElementById("catalogPage");
  if (!catalogPage) return null;
  const filterPanel = catalogPage.querySelector(".catalog-filter-panel");
  const panel = document.createElement("article");
  panel.id = PANEL_ID;
  panel.className = "panel sqlite-dwh-panel";
  panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <span class="section-kicker">DWH → SQLite</span>
        <h2>Caricamento catalogo SKU/EAN</h2>
        <p>Carica in SQLite gli EAN presenti nella vista V_ZONEMIND_ARTICLES. Il sync non cancella mai gli EAN già presenti.</p>
      </div>
      <div class="sqlite-dwh-actions">
        <button id="sqliteDwhSync" type="button">Sincronizza</button>
        <button id="sqliteDwhFull" type="button" class="ghost-button">Full reload</button>
        <button id="sqliteDwhRefresh" type="button" class="ghost-button">Aggiorna stato</button>
      </div>
    </div>
    <div class="sqlite-dwh-kpis">
      <div class="sqlite-dwh-kpi"><small>Righe SQLite</small><strong id="sqliteDwhRows">—</strong></div>
      <div class="sqlite-dwh-kpi"><small>Stagioni</small><strong id="sqliteDwhSeasons">—</strong></div>
      <div class="sqlite-dwh-kpi"><small>Negozi</small><strong id="sqliteDwhStores">—</strong></div>
      <div class="sqlite-dwh-kpi"><small>Articoli</small><strong id="sqliteDwhArticles">—</strong></div>
      <div class="sqlite-dwh-kpi"><small>EAN</small><strong id="sqliteDwhEans">—</strong></div>
    </div>
    <div id="sqliteDwhMessage" class="sqlite-dwh-message" hidden></div>
    <div id="sqliteDwhLog" class="sqlite-dwh-log" hidden></div>
  `;
  if (filterPanel) catalogPage.insertBefore(panel, filterPanel);
  else catalogPage.appendChild(panel);
  document.getElementById("sqliteDwhSync").addEventListener("click", () => executeDwhLoad("sync"));
  document.getElementById("sqliteDwhFull").addEventListener("click", () => executeDwhLoad("full"));
  document.getElementById("sqliteDwhRefresh").addEventListener("click", refreshDwhStatus);
  refreshDwhStatus();
  return panel;
}

function dwhMessage(text, kind = "") {
  const message = document.getElementById("sqliteDwhMessage");
  if (!message) return;
  message.hidden = false;
  message.textContent = text;
  message.className = `sqlite-dwh-message ${kind}`.trim();
}

function dwhBusy(busy) {
  ["sqliteDwhSync", "sqliteDwhFull", "sqliteDwhRefresh"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.disabled = busy;
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
  return payload;
}

function renderDwhStatus(payload) {
  const catalog = payload.catalog || payload || {};
  document.getElementById("sqliteDwhRows").textContent = zmNumber(catalog.rows);
  document.getElementById("sqliteDwhSeasons").textContent = zmNumber(catalog.seasons);
  document.getElementById("sqliteDwhStores").textContent = zmNumber(catalog.stores);
  document.getElementById("sqliteDwhArticles").textContent = zmNumber(catalog.articles);
  document.getElementById("sqliteDwhEans").textContent = zmNumber(catalog.eans);
  const runs = catalog.runs || [];
  const log = document.getElementById("sqliteDwhLog");
  if (!runs.length) {
    log.hidden = true;
    log.innerHTML = "";
    return;
  }
  log.hidden = false;
  log.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Tipo</th><th>Inizio</th><th>Fine</th><th>Righe</th><th>Scarti</th><th>Stato</th><th>Messaggio</th></tr></thead>
      <tbody>
        ${runs.map(run => `
          <tr>
            <td>${zmEscape(run.sync_id)}</td>
            <td>${zmEscape(run.sync_type)}</td>
            <td>${zmEscape(zmDate(run.started_at))}</td>
            <td>${zmEscape(zmDate(run.ended_at))}</td>
            <td>${zmEscape(zmNumber(run.rows_read))}</td>
            <td>${zmEscape(zmNumber(run.rows_rejected))}</td>
            <td>${zmEscape(run.status)}</td>
            <td>${zmEscape(run.message || "")}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  `;
}

async function refreshDwhStatus() {
  ensureDwhPanel();
  dwhBusy(true);
  try {
    const payload = await requestJson("/api/admin/catalog/sqlite-dwh/status");
    renderDwhStatus(payload);
    dwhMessage("Stato catalogo SQLite aggiornato.", "ok");
  } catch (error) {
    dwhMessage(error.message, "error");
  } finally {
    dwhBusy(false);
  }
}

async function executeDwhLoad(type) {
  const isFull = type === "full";
  if (isFull && !window.confirm("Eseguire il full reload del catalogo SQLite? Usare solo per primo caricamento o rebuild.")) return;
  dwhBusy(true);
  dwhMessage(isFull ? "Full reload in corso..." : "Sincronizzazione DWH in corso...");
  try {
    const payload = await requestJson(`/api/admin/catalog/sqlite-dwh/${type}`, { method: "POST" });
    renderDwhStatus(payload);
    dwhMessage(`${isFull ? "Full reload" : "Sincronizzazione"} completata. Righe lette: ${zmNumber(payload.rowsRead)}.`, "ok");
    const refresh = document.getElementById("catalogRefreshButton");
    if (refresh) refresh.click();
  } catch (error) {
    dwhMessage(error.message, "error");
  } finally {
    dwhBusy(false);
  }
}

const observer = new MutationObserver(() => {
  const catalogPage = document.getElementById("catalogPage");
  if (catalogPage && !catalogPage.hidden) ensureDwhPanel();
});
observer.observe(document.body, { attributes: true, childList: true, subtree: true });

window.addEventListener("DOMContentLoaded", () => {
  const catalogPage = document.getElementById("catalogPage");
  if (catalogPage && !catalogPage.hidden) ensureDwhPanel();
});
