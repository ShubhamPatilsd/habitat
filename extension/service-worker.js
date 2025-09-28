// service-worker.js
// Minimal background worker. Keeps extension light.
// We'll also use it to create a "Send selection" context menu for quick capture.

chrome.runtime.onInstalled.addListener(() => {
  // create context menu item for selection
  try {
    chrome.contextMenus.create({
      id: "habitat-send-selection",
      title: "Send selection to Habitat",
      contexts: ["selection"],
    });
  } catch (e) {
    console.warn("contextMenus.create failed", e);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "habitat-send-selection" && tab) {
    // open popup-like flow by injecting content script and sending scrape
    // For simplicity, open a new tab to the extension popup page with parameters
    // Alternative: send a message to content script and then background can POST
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        files: ["contentScript.js"],
      })
      .then(() => {
        chrome.tabs.sendMessage(tab.id, { action: "scrape" }, (resp) => {
          if (resp && resp.data) {
            // open site with a lightweight preview page; here we open the popup HTML in a tab so user can proceed
            chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
          }
        });
      })
      .catch((err) => console.warn("context injection failed", err));
  }
});
