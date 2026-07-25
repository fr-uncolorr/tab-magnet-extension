// SETTINGS

// Auto organize tabs toggle
const autoOrganizeCheckbox = document.getElementById("autoOrganize");

autoOrganizeCheckbox.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    autoOrganize: autoOrganizeCheckbox.checked,
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

  const { organizeMode = "end" } = await chrome.storage.sync.get("organizeMode");
  organizeTabsMode.value = organizeMode;
});

// INTERACTIVE BUTTONS
// listen when "order all tabs" button clicked
document.getElementById("reorder-window").addEventListener("click", () => {
  chrome.runtime.sendMessage({
    action: "reorder-window",
  });
});
