// SETTINGS

// Auto organize tabs toggle
const autoOrganizeCheckbox = document.getElementById("autoOrganize");

autoOrganizeCheckbox.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    autoOrganize: autoOrganizeCheckbox.checked,
  });
});

// Auto organize ALL tabs in window toggle
const autoOrganizeFullWindowCheckbox = document.getElementById(
  "autoOrganizeFullWindow",
);

autoOrganizeFullWindowCheckbox.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    autoOrganizeFullWindow: autoOrganizeFullWindowCheckbox.checked,
  });
});

// Organize new tabs selector
const organizeTabsMode = document.getElementById("organizeNewTabs");

organizeTabsMode.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    organizeMode: organizeTabsMode.value,
  });
});

// LOADER
// when popup loaded, grab settings. also defaults when needed
document.addEventListener("DOMContentLoaded", async () => {
  const { autoOrganize = true } = await chrome.storage.sync.get("autoOrganize");
  autoOrganizeCheckbox.checked = autoOrganize;

  const { autoOrganizeFullWindow = false } = await chrome.storage.sync.get(
    "autoOrganizeFullWindow",
  );
  autoOrganizeFullWindowCheckbox.checked = autoOrganizeFullWindow;

  const { organizeMode = "end" } =
    await chrome.storage.sync.get("organizeMode");
  organizeTabsMode.value = organizeMode;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = chrome.i18n.getMessage(key);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = chrome.i18n.getMessage(el.dataset.i18nTitle);
  });
});

// INTERACTIVE BUTTONS
// listen when "order all tabs" button clicked
document.getElementById("reorder-window").addEventListener("click", () => {
  chrome.runtime.sendMessage({
    action: "reorder-window",
  });
});
