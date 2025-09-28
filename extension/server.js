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

    // Always generate a unique ID for storage/lookup
    const id = crypto.randomBytes(8).toString("hex");

    // Human-friendly title shown to users
    const nodeTitle = title || page.title || page.metaDescription || page.url;

    const node = {
      id, // unique identifier
      title: nodeTitle, // what users see
      page, // scraped page object
      summary: summary || [],
      tags: tags || [],
      rabbitholeId: rabbitholeId || null,
      createdAt: createdAt || new Date().toISOString(),
    };

    // Save as file named after the unique ID
    fs.writeFileSync(
      path.join(STORAGE_DIR, id + ".json"),
      JSON.stringify(node, null, 2)
    );

    const nodeUrl = `http://localhost:3001/node/${id}`;
    console.log("✅ Created node", id, "for", page.url);
    return res.json({ success: true, nodeUrl });
  } catch (err) {
    console.error("❌ Error creating node:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// Always return JSON for a single node
app.get("/node/:id", (req, res) => {
  const id = req.params.id;
  const file = path.join(STORAGE_DIR, id + ".json");

  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: "Not found" });
  }

  const node = JSON.parse(fs.readFileSync(file, "utf8"));
  res.json(node);
});

// API alias: same as above, but namespaced
app.get("/api/node/:id", (req, res) => {
  const id = req.params.id;
  const file = path.join(STORAGE_DIR, id + ".json");

  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: "Not found" });
  }

  const node = JSON.parse(fs.readFileSync(file, "utf8"));
  res.json(node);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log("🚀 Example Habitat server listening on", PORT)
);
