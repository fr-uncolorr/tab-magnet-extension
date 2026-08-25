let tabHosts = new Map();
let pendingTabs = new Set();

chrome.tabs.onCreated.addListener(async (tab) => {
  pendingTabs.add(tab.id);
  console.log("added to pendingTabs: " + tab.id);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!pendingTabs.has(tabId)) {
    console.log("tabId " + tab.id + " NOT in pendingTabs");
    await handleSpaNavigation(tabId, changeInfo, tab);
    return;
  } else {
    console.log("tabId " + tab.id + " IS in pendingTabs");
  }

  const url = changeInfo.url || tab.url || tab.pendingUrl;
  if (!url) return;

  const { autoOrganize = true } = await chrome.storage.sync.get("autoOrganize");

  if (!autoOrganize) {
    console.log("autoOrganize disabled");
    return;
  }

  await organizeTab(tab);

  pendingTabs.delete(tab.id);
});

// grabs the host name from given tab
// tabs like 'chrome://settings' still output 'settings'
function getHostname(tab) {
  return new URL(tab.url).hostname;
}

// fetches and return all tabs from current window
// querying single window guarantees
// array organized same as tabs order in browser
function fetchTabs(windowId) {
  return chrome.tabs.query({ windowId });
}

// finds last matching tab other than the one that triggered this event
async function findTargetIndex(tabs, tab) {
  const currentHost = getHostname(tab);

  const sameHost = tabs.filter(
    (candidate) =>
      candidate.id !== tab.id && getHostname(candidate) === currentHost,
  );

  if (sameHost.length === 0) return;

  const { organizeMode = "end" } =
    await chrome.storage.sync.get("organizeMode");

  // "begin" references left-most tab
  // "end" references right-most tab
  // using reduce to return full tab object
  // tab = item in the function below
  const referenceTab = sameHost.reduce((acc, item) => {
    const isReference =
      organizeMode === "begin"
        ? item.index < acc.index
        : item.index > acc.index;

    return isReference ? item : acc;
  });

  // chrome.tabs.move trata "index" como a posicao FINAL da aba, depois
  // dela ja ter sido removida do array original. isso significa que,
  // se a aba que estamos movendo (tab) estiver posicionada ANTES da
  // referencia, a remocao dela desloca a referencia uma posicao pra
  // tras - e precisamos compensar isso no calculo, ou erramos por 1.
  const referenceShiftsBack = tab.index < referenceTab.index;
  const referenceIndexAfterRemoval = referenceShiftsBack
    ? referenceTab.index - 1
    : referenceTab.index;

  // "begin": aba deve pousar imediatamente ANTES da referencia
  // "end":   aba deve pousar imediatamente DEPOIS da referencia
  return organizeMode === "begin"
    ? referenceIndexAfterRemoval
    : referenceIndexAfterRemoval + 1;
}

// never change targetIndex value here
// pass the correct targetIndex already
function moveToTarget(tab, targetIndex) {
  chrome.tabs.move(tab.id, {
    index: targetIndex,
  });
}

async function organizeTab(tab) {
  const tabs = await fetchTabs(tab.windowId);
  const targetIndex = await findTargetIndex(tabs, tab);

  const { autoOrganizeFullWindow = false } = await chrome.storage.sync.get("autoOrganizeFullWindow");

  if (autoOrganizeFullWindow) {
    console.log("organizing full window: " + tab.windowId);
    organizeFullWindow(tab.windowId);
  }

  if (targetIndex !== undefined) {
    moveToTarget(tab, targetIndex);
  }
}

// trata abas quando url alterado, normalmente navegacao SPA
// onde o host continua igual mas url muda
//
// nesse caso nao queremos simplesmente rodar organizeTab de novo,
// pois aba pode já estar agrupada corretamente.
// so queremos mover se de fato não estiver agrupada
async function handleSpaNavigation(tabId, chanfeInfo, tab) {
  // early return se não for mudança de url
  if (!chanfeInfo.url) return;

  const { autoOrganize = true } = await chrome.storage.sync.get("autoOrganize");

  if (!autoOrganize) return;

  const tabs = await fetchTabs(tab.windowId);

  if (isTabGrouped(tabs, tab)) {
    console.log("tab " + tabId + " already grouped, skipping");
    return;
  }

  console.log("tab" + tabId + " not grouped, organizing");
  await organizeTab(tab);
}

// verifica se aba está adjacente em pelo menos uma outra aba do mesmo host.
// uma aba sem nenhuma outra do mesmo host na janela é considera agrupada,
// ja que nao ha com o que agrupar.
function isTabGrouped(tabs, tab) {
  const currentHost = getHostname(tab);
  const sorted = [...tabs].sort((a, b) => a.index - b.index);
  const pos = sorted.findIndex((t) => t.id === tab.id);

  // if tab not found, return
  if (pos === -1) return true;

  const hasSameHostTab = sorted.some(
    (t) => t.id !== tab.id && getHostname(t) === currentHost,
  );

  // if its the only tab with that host, consider grouped
  if (!hasSameHostTab) return true;

  const prev = sorted[pos - 1];
  const next = sorted[pos + 1];

  return (
    (prev && getHostname(prev) === currentHost) ||
    (next && getHostname(next) === currentHost)
  );
}

// function that organizes all opened windows
// can pass undefined windowId and it will organize all windows
// tabs.query: Gets all tabs that have the specified properties, or all tabs if no properties are specified.
async function organizeFullWindow(windowId) {
  const { organizesAllWindows = false } = await chrome.storage.sync.get("organizesAllWindows");

  if (organizesAllWindows) {
    windowId = null;
    console.log("organizing on all window, setting windowId to undefined. windowId: " + windowId);
  }
  
  const tabs = await chrome.tabs.query({ windowId });

  console.log("fetched tabs: " + tabs.map(tab => getHostname(tab)));

  const groups = new Map();

  for (const tab of tabs) {
    const host = getHostname(tab);

    // if group dont exist yet, create
    if (!groups.has(host)) {
      groups.set(host, []);
    }

    // add to gruop
    groups.get(host).push(tab);
  }

  // order: most tabs on left, less tabs on right
  const sortedGroups = new Map(
    [...groups.entries()].sort((a, b) => b[1].length - a[1].length),
  );

  // flatten in desired order
  const orderedTabs = [...sortedGroups.values()].flat();

  // move each tab
  for (let i = 0; i < orderedTabs.length; i++) {
    await chrome.tabs.move(orderedTabs[i].id, {
      index: i,
    });
  }
}

// listener for when tab is closed, to clean maps
chrome.tabs.onRemoved.addListener((tabId) => {
  tabHosts.delete(tabId);
  // console.log('Snapshot:', [...tabHosts]);
});

// listener for actions in the popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "reorder-window") {
    console.log("organizing full window for id " + message.windowId);
    organizeFullWindow(message.windowId);
  }
});
