const tabHosts = new Map();

// listener for when new tab created
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  const host = getHostname(tab);
  const previousHost = tabHosts.get(tabId);

  // if same host, dont move
  if (previousHost === host) {
    return;
  }

  // new host/first time seeing host
  // update stored host
  tabHosts.set(tabId, host);

  const tabs = await fetchTabs(tab.windowId);

  const targetIndex = findTargetIndex(tabs, tab);

  console.log("index of last match:", targetIndex);

  if (targetIndex) {
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
function findTargetIndex(tabs, tab) {
  const currentHost = getHostname(tab);

  const sameHost = tabs.filter(
    (candidate) =>
      candidate.id !== tab.id && getHostname(candidate) === currentHost,
  );

  if (sameHost.length > 0) {
    // console.log("tabs with the same host", sameHost);

    // using reduce to return full tab object
    const lastMatch = sameHost.reduce((max, tab) =>
      tab.index > max.index ? tab : max,
    );

    return lastMatch.index;
  } else {
    return;
  }
}

function moveToTarget(tab, targetIndex) {
  chrome.tabs.move(tab.id, {
    index: targetIndex + 1,
  });
}

// listener for when extension icon clicked
chrome.action.onClicked.addListener((tab) => {
  console.log("icon clicked at tab:", tab.id);

  // call future function that will
  // order all opened tabs in current window
});

// listener for when tab is closed, to clean maps
chrome.tabs.onRemoved.addListener((tabId) => {
  tabHosts.delete(tabId);
  // console.log('Snapshot:', [...tabHosts]);
});
