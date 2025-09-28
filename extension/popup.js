// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const scrapeBtn = document.getElementById("scrapeBtn");
  const statusEl = document.getElementById("status");
  const previewWrap = document.getElementById("previewWrap");
  const previewEl = document.getElementById("preview");

  scrapeBtn.addEventListener("click", async () => {
    statusEl.textContent = "⏳ Scraping page...";

    try {
      // get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url) {
        statusEl.textContent = "❌ No active tab found.";
        return;
      }

      // grab form values
      const titleInput = document.getElementById("titleInput").value.trim();
      const tagsInput = document.getElementById("tagsInput").value.trim();
      const rabbitholeId = document.getElementById("rabbithole").value.trim();

      const tags = tagsInput
        ? tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      // call backend server
      const res = await fetch("http://localhost:3001/api/rabbithole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: {
            url: tab.url,
            title: tab.title || "Untitled Page",
          },
          title: titleInput || undefined,
          tags,
          rabbitholeId: rabbitholeId || undefined,
          summary: ["Captured via Habitat extension"], // placeholder for now
        }),
      });

      const data = await res.json();

      if (data.success) {
        statusEl.textContent = "✅ Node created!";
        previewWrap.style.display = "block";
        previewEl.textContent = JSON.stringify(data, null, 2);

        // Redirect into Habitat frontend instead of backend
        // extract the id from nodeUrl (e.g. http://localhost:3001/node/abc123)
        const nodeUrl = data.nodeUrl;
        const id = nodeUrl.split("/").pop();

        const habitatUrl = `http://localhost:3000/nodes?id=${id}`;
        chrome.tabs.create({ url: habitatUrl });
      } else {
        statusEl.textContent = "❌ Server error.";
        console.error("Server error:", data);
      }
    } catch (err) {
      console.error("Error:", err);
      statusEl.textContent = "❌ Could not connect to backend.";
    }
  });
});
