const tabHosts = new Map();

async function hydration(skipTabId) {
  const allTabs = await chrome.tabs.query({});
  for (const t of allTabs) {
    // skip the tab id of the newly created tab
    // ensure hydration only affects when worker was cold
    if (t.id === skipTabId) continue;
    tabHosts.set(t.id, getHostname(t));
  }
}

// listener for when new tab created
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  const host = getHostname(tab);
  let previousHost = tabHosts.get(tabId);

  if (previousHost === undefined) {
    await hydration(tabId);
    previousHost = tabHosts.get(tabId);
  }

  console.log("current host is " + host + " and previous is " + previousHost);

  // if same host, dont move
  if (previousHost === host) {
    return;
  }

  // new host/first time seeing host
  // update stored host
  tabHosts.set(tabId, host);

  const tabs = await fetchTabs(tab.windowId);

  const targetIndex = await findTargetIndex(tabs, tab);

  console.log("index of last match:", targetIndex);

  const { autoOrganize = true } = await chrome.storage.sync.get("autoOrganize");

  if (targetIndex !== undefined && autoOrganize) {
    moveToTarget(tab, targetIndex);
  }
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

  const { organizeMode = "end" } =
    await chrome.storage.sync.get("organizeMode");

  if (sameHost.length > 0) {
    // using reduce to return full tab object
    // tab = item in the function below
    const targetTab = sameHost.reduce((acc, item) => {
      const isTarget =
        organizeMode === "begin"
          ? item.index < acc.index
          : item.index > acc.index;

      return isTarget ? item : acc;
    });

    return organizeMode === "begin" ? targetTab.index - 1 : targetTab.index;
  } else {
    return;
  }
}

function moveToTarget(tab, targetIndex) {
  chrome.tabs.move(tab.id, {
    index: targetIndex + 1,
  });
}

async function reorderWindow(windowId) {
  const tabs = await chrome.tabs.query({ windowId });

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
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "reorder-window") {
    chrome.windows.getCurrent((window) => {
      reorderWindow(window.windowId);
    });
  }
});
