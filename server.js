// ============================================================
// Feldiserhof – Express.js szerver
// ============================================================
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// Alapbeállítások
// ============================================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.basedir = app.get("views");

// Statikus fájlok kiszolgálása
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// Helper függvény JSON biztonságos olvasáshoz
// ============================================================
const loadJSON = (filePath) => {
  try {
    const fullPath = path.join(__dirname, "public", filePath);
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (err) {
    console.error(`❌ Hiba a(z) ${filePath} betöltésekor:`, err.message);
    return null;
  }
};

// ============================================================
// Főoldal
// ============================================================
app.get("/", (req, res) => {
  const menuData = loadJSON("menu.json");
  const openingHours = loadJSON("opening-hours.json");

  if (!menuData || !openingHours) {
    console.error("❌ Menü vagy nyitvatartás adat nem található.");
    return res.status(500).send("Server error: Menü vagy nyitvatartás adat nem található.");
  }

  res.render("index", {
    title: "Feldiserhof – Hotel & Restaurant",
    description:
      "Hotel, Restaurant & Café Feldis – feine Küche, regionale Zutaten, kleine Wellness-Oase.",
    menu: menuData,
    hours: openingHours,
  });
});

// ============================================================
// Galéria oldal
// ============================================================
app.get("/gallery", (req, res) => {
  res.render("gallery", {
    title: "Galerie – Feldiserhof",
    description: "Einblick in unser Hotel, Restaurant und Wellnessbereich.",
  });
});

// ============================================================
// Galéria API – albumosított olvasás (public/gallery/...)
// ============================================================
app.get("/api/gallery", (req, res) => {
  const galleryDir = path.join(__dirname, "public", "gallery");
  const albums = {};

  try {
    // Ellenőrizze, hogy a mappa létezik
    if (!fs.existsSync(galleryDir)) {
      return res.status(404).json({ error: "Gallery folder not found." });
    }

    const folders = fs.readdirSync(galleryDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const folder of folders) {
      const folderPath = path.join(galleryDir, folder);
      const files = fs.readdirSync(folderPath)
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .map(f => ({
          src: `/gallery/${folder}/${f}`,
          alt: `${folder} – ${f.replace(/\.[^/.]+$/, "")}`,
        }));

      albums[folder] = files;
    }

    res.json({ albums });
  } catch (err) {
    console.error("❌ Galéria betöltési hiba:", err);
    res.status(500).json({ error: "Failed to load gallery." });
  }
});


// ============================================================
// 404 – Ha nem található az oldal
// ============================================================
app.use((req, res) => {
  res.status(404).send("404 – Az oldal nem található.");
});

// ============================================================
// Szerver indítása
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Feldiserhof szerver fut: http://localhost:${PORT}`);
});
