// server.js
import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ allow larger JSON bodies
app.use(express.json({ limit: "50mb" }));

// CORS for testing
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

const STORAGE_DIR = path.join(__dirname, "nodes");
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);

app.post("/api/rabbithole", (req, res) => {
  try {
    const { page, summary, title, tags, rabbitholeId, createdAt } =
      req.body || {};

    if (!page || !page.url) {
      return res.status(400).json({ error: "missing page payload" });
    }

    const id = crypto.randomBytes(8).toString("hex");
    const node = {
      id,
      title: title || page.title || page.metaDescription || page.url,
      page,
      summary: summary || [],
      tags: tags || [],
      rabbitholeId: rabbitholeId || null,
      createdAt: createdAt || new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(STORAGE_DIR, id + ".json"),
      JSON.stringify(node, null, 2)
    );

    const nodeUrl = `http://localhost:3000/node/${id}`;
    console.log("Created node", id, "for", page.url);
    return res.json({ success: true, nodeUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error" });
  }
});

app.get("/node/:id", (req, res) => {
  const id = req.params.id;
  const file = path.join(STORAGE_DIR, id + ".json");
  if (!fs.existsSync(file)) return res.status(404).send("Not found");
  const node = JSON.parse(fs.readFileSync(file, "utf8"));
  res.send(
    `<html><body><h1>${escapeHtml(node.title)}</h1><h3>Summary</h3><ul>${(
      node.summary || []
    )
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join(
        ""
      )}</ul><h3>Source</h3><a href="${escapeHtml(node.page.url)}" target="_blank">${escapeHtml(
      node.page.url
    )}</a><pre style="white-space:pre-wrap;">${escapeHtml(JSON.stringify(node.page, null, 2))}</pre></body></html>`
  );
});

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ]
  );
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log("Example Habitat server listening on", PORT)
);
