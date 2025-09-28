// contentScript.js
// Runs in page context. Listens for a scrape request and returns structured data.
//
// The popup injects this file and then asks for a scrape via runtime messaging.
// This file tries to avoid breaking pages; it uses simple DOM reads and light heuristics.

(function () {
  // only add one listener
  if (window.__habitatContentScriptInstalled) return;
  window.__habitatContentScriptInstalled = true;

  // message relay support: extension background may forward the message via runtime
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (msg && msg.action === "scrape") {
        const result = scrapePage();
        sendResponse({ success: true, data: result });
      } else {
        // ignore other messages
      }
    } catch (err) {
      sendResponse({ error: err && err.message ? err.message : String(err) });
    }
    // indicate we're responding synchronously
    return true;
  });

  function scrapePage() {
    const url = location.href;
    const title = document.title || "";
    const selection =
      (window.getSelection ? window.getSelection().toString() : "") || "";

    const metaDescription =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      "";

    const firstImage =
      document.querySelector('meta[property="og:image"]')?.content ||
      document.querySelector('meta[name="twitter:image"]')?.content ||
      (document.images && document.images.length ? document.images[0].src : "");

    // gather headings
    const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
      .map((h) => h.innerText.trim())
      .filter(Boolean)
      .slice(0, 10);

    // Try a simple content extraction heuristic:
    // choose a container with most paragraph text.
    const paragraphs = Array.from(document.querySelectorAll("p"))
      .map((p) => p.innerText.trim())
      .filter((t) => t.length > 20);

    // find the node with most <p> children text length
    let articleText = "";
    try {
      const candidates = Array.from(
        document.querySelectorAll('article, main, [role="main"], section, div')
      );
      let best = { score: 0, text: "" };
      candidates.forEach((node) => {
        try {
          const ps = Array.from(node.querySelectorAll("p")).map((p) =>
            p.innerText.trim()
          );
          const combined = ps.filter(Boolean).join("\n\n");
          const score = combined.length;
          if (score > best.score) best = { score, text: combined };
        } catch (e) {
          /* ignore */
        }
      });
      if (best.score > 200) {
        articleText = best.text;
      } else {
        // fallback: use paragraphs across page
        articleText = paragraphs.slice(0, 40).join("\n\n");
      }
    } catch (e) {
      articleText = paragraphs.slice(0, 40).join("\n\n");
    }

    // basic keyword extraction: pick top words by frequency excluding stopwords
    const keywords = extractKeywords(articleText, 10);

    // collect links from the main block (top 10)
    const links = Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 30)
      .map((a) => ({ href: a.href, text: a.innerText.trim() }));

    return {
      url,
      title,
      metaDescription,
      firstImage,
      selection,
      headings,
      articleText,
      keywords,
      links,
      scrapedAt: new Date().toISOString(),
    };
  }

  function extractKeywords(text, max = 8) {
    if (!text || text.length < 30) return [];
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
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !stopwords.has(w) && w.length > 3);
    const freq = {};
    words.forEach((w) => (freq[w] = (freq[w] || 0) + 1));
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map((x) => x[0]);
  }
})();
