// popup.js
// This script coordinates injecting the content script, receiving scraped data,
// summarizing it, then posting to the server to create a node.

const SCRAPE_TIMEOUT_MS = 8000;

// helper: promisified messaging to content script
function sendMessageToTab(tabId, message, timeout = SCRAPE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let handled = false;
    const onResponse = (response) => {
      if (handled) return;
      handled = true;
      resolve(response);
    };

    chrome.runtime.sendMessage(
      { relayToTab: true, tabId, message },
      onResponse
    );

    // fallback in case no response
    setTimeout(() => {
      if (!handled) {
        handled = true;
        reject(new Error("timeout waiting for content script"));
      }
    }, timeout);
  });
}

// simple sentence-level summarizer (term frequency based)
function summarizeText(text, maxSentences = 4) {
  if (!text || typeof text !== "string") return [];
  // split into sentences (simple)
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length <= maxSentences) return sentences;

  // build term frequency
  const stopwords = new Set([
    "the",
    "and",
    "is",
    "in",
    "to",
    "a",
    "of",
    "it",
    "for",
    "on",
    "that",
    "this",
    "with",
    "as",
    "are",
    "was",
    "be",
    "by",
    "an",
    "or",
    "from",
    "at",
    "has",
    "have",
    "but",
    "not",
    "they",
    "their",
    "its",
    "can",
    "will",
    "we",
    "you",
  ]);

  const tf = {};
  const tokenize = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !stopwords.has(t));

  sentences.forEach((s) => {
    const tokens = tokenize(s);
    tokens.forEach((t) => (tf[t] = (tf[t] || 0) + 1));
  });

  // score sentences
  const scores = sentences.map((s) => {
    const tokens = tokenize(s);
    const score = tokens.reduce((acc, t) => acc + (tf[t] || 0), 0);
    // normalize by length
    return score / Math.sqrt(tokens.length + 1);
  });

  // pick top sentences
  const idxs = scores
    .map((sc, i) => ({ sc, i }))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i) // re-order by original position
    .map((x) => x.i);

  return idxs.map((i) => sentences[i]);
}

// small helper to show status
function setStatus(text, isError = false) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.style.color = isError ? "#b00020" : "#333";
}

async function main() {
  document.getElementById("scrapeBtn").addEventListener("click", async () => {
    setStatus("Looking for active tab...");
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      setStatus("No active tab found", true);
      return;
    }

    setStatus("Injecting content script...");
    try {
      // inject content script into page context using scripting API
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["contentScript.js"],
      });
    } catch (e) {
      // some pages like chrome:// will fail; still try messaging
      console.warn("executeScript may have failed:", e.message || e);
    }

    setStatus("Requesting page scrape...");
    let scraped;
    try {
      const resp = await sendMessageToTab(
        tab.id,
        { action: "scrape" },
        SCRAPE_TIMEOUT_MS
      );
      if (!resp || resp.error) {
        setStatus("Scrape failed: " + (resp?.error || "no response"), true);
        return;
      }
      scraped = resp.data;
    } catch (err) {
      setStatus("Scrape error: " + err.message, true);
      return;
    }

    // fill title input if empty
    const titleInput = document.getElementById("titleInput");
    if (!titleInput.value.trim())
      titleInput.value =
        scraped.title || scraped.metaDescription || scraped.url;

    // summarize
    setStatus("Summarizing page...");
    const summary = summarizeText(
      scraped.articleText || scraped.metaDescription || "",
      4
    );

    // show preview
    const previewWrap = document.getElementById("previewWrap");
    const preview = document.getElementById("preview");
    if (summary.length) {
      previewWrap.style.display = "block";
      preview.innerHTML =
        "<ul>" +
        summary.map((s) => `<li>${escapeHtml(s)}</li>`).join("") +
        "</ul>";
    } else {
      previewWrap.style.display = "none";
      preview.innerHTML = "";
    }

    // prepare payload
    const payload = {
      page: scraped,
      summary,
      title: document.getElementById("titleInput").value.trim(),
      tags: document
        .getElementById("tagsInput")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      rabbitholeId: document.getElementById("rabbithole").value.trim() || null,
      createdAt: new Date().toISOString(),
    };

    setStatus("Sending to Habitat...");
    try {
      const resp = await fetch(
        "https://habitat-aiasdiasida.com/api/rabbithole",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!resp.ok) {
        const txt = await resp.text();
        setStatus(`Server error ${resp.status}: ${txt}`, true);
        return;
      }

      const data = await resp.json(); // expect { success: true, nodeUrl: "..." }
      if (data?.nodeUrl) {
        setStatus("Opened node: " + data.nodeUrl);
        // open node in new tab
        chrome.tabs.create({ url: data.nodeUrl });
      } else {
        setStatus("Unexpected server response", true);
      }
    } catch (err) {
      setStatus("Network error: " + err.message, true);
    }
  });
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m];
  });
}

main().catch((e) => console.error(e));
