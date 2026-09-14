const isDesktop = () => Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

function click(selector) {
  const element = document.querySelector(selector);
  if (!element) return false;
  element.click();
  return true;
}

function navigate(view, action = null) {
  if (!click(`[data-action="navigate"][data-view="${view}"]`)) return;
  if (action) window.setTimeout(() => click(`[data-action="${action}"]`), 120);
}

function runCommand(command) {
  switch (command) {
    case "new-sale": navigate("sales"); break;
    case "new-purchase": navigate("purchases", "new-purchase"); break;
    case "sales": navigate("sales"); break;
    case "purchases": navigate("purchases"); break;
    case "customers": navigate("customers"); break;
    case "inventory": navigate("inventory"); break;
    case "reports": navigate("reports"); break;
    case "settings": navigate("settings"); break;
    case "general-settings": navigate("general-settings"); break;
    case "backup": navigate("data-management", "export-backup"); break;
    case "restore": click("#restore-file"); break;
    case "print": click('[data-action="export-report"]'); break;
    default: break;
  }
}

export async function installDesktopIntegration() {
  if (!isDesktop()) return;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen("desktop-command", ({ payload }) => runCommand(String(payload || "")));
  } catch (error) {
    console.warn("[Hesabi desktop integration unavailable]", error);
  }
  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (event.key === "Escape") return;
    if (modifier && key === "n" && event.shiftKey) { event.preventDefault(); runCommand("new-purchase"); return; }
    if (modifier && key === "n") { event.preventDefault(); runCommand("new-sale"); return; }
    if (modifier && key === "p") { event.preventDefault(); runCommand("print"); return; }
    if (event.key === "F4") { event.preventDefault(); runCommand("sales"); return; }
    if (event.key === "F6") { event.preventDefault(); runCommand("purchases"); }
  });
}
