const menuItems = [
  { id: "dashboard", label: "Dashboard", enabled: true },
  { id: "stores", label: "Negozi", enabled: true },
  { id: "catalog", label: "Catalogo", enabled: true },
  { id: "layouts", label: "Layout", enabled: true },
  { id: "assignments", label: "Associazioni", enabled: false },
  { id: "system", label: "Sistema", enabled: false }
];

export function initializeShell({ version = "0.8.5", onNavigate } = {}) {
  const sidebar = document.getElementById("appSidebar");
  const menu = document.getElementById("appMenu");
  const menuToggle = document.getElementById("menuToggle");
  const versionNode = document.getElementById("frontendVersion");
  if (versionNode) versionNode.textContent = version;
  if (menu) {
    menu.innerHTML = menuItems.map(item => `
      <button class="nav-item ${item.id === "dashboard" ? "active" : ""}" type="button"
        data-section="${item.id}" ${item.enabled ? "" : "disabled"}
        title="${item.enabled ? item.label : `${item.label}: disponibile nei prossimi step`}">
        <span>${item.label}</span>${item.enabled ? "" : '<small>prossimamente</small>'}
      </button>`).join("");
    menu.addEventListener("click", event => {
      const button = event.target.closest("button[data-section]:not(:disabled)");
      if (!button) return;
      menu.querySelectorAll(".nav-item").forEach(x => x.classList.toggle("active", x === button));
      onNavigate?.(button.dataset.section);
      sidebar?.classList.remove("sidebar-open");
    });
  }
  menuToggle?.addEventListener("click", () => sidebar?.classList.toggle("sidebar-open"));
}
