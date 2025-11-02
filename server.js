// ============================================================
// Feldiserhof – Express.js szerver (admin-ready + i18n + Wellness + Rooms)
// + Feature Flag: "menuBookEnabled" (könyv nyithatóság adminból)
// ============================================================
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from "express-session";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import csrf from "csurf";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// i18n
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import i18nextMiddleware from "i18next-http-middleware";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

// ============================================================
// Konzol header
// ============================================================
console.log("===============================================");
console.log("🚀 Feldiserhof szerver indul...");
console.log("📦 NODE_ENV:", process.env.NODE_ENV || "(nincs megadva)");
console.log("===============================================");

// ============================================================
// Nyelvi fájlok gyors ellenőrzése
// ============================================================
const huPath = path.join(__dirname, "locales", "hu", "translation.json");
const dePath = path.join(__dirname, "locales", "de", "translation.json");
console.log("🔍 Nyelvi fájlok:");
console.log("   HU:", fs.existsSync(huPath) ? "OK" : "HIÁNYZIK", "→", huPath);
console.log("   DE:", fs.existsSync(dePath) ? "OK" : "HIÁNYZIK", "→", dePath);

// ============================================================
// Feature flags – perzisztens tárolás
// ============================================================
const DATA_DIR = path.join(__dirname, "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

// biztosítsuk a /data könyvtárat
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      const defaults = { menuBookEnabled: true };
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaults, null, 2), "utf8");
      console.log("✅ Alapértelmezett settings.json létrehozva");
      return defaults;
    }
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch (e) {
    console.error("❌ Settings betöltési hiba:", e.message);
    return { menuBookEnabled: true };
  }
}
function writeSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), "utf8");
  } catch (e) {
    console.error("❌ Settings mentési hiba:", e.message);
  }
}
let SETTINGS = readSettings();

// ============================================================
// i18next init (cookie detektálás)
// ============================================================
await i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init(
    {
      fallbackLng: "hu",
      preload: ["hu", "de"],
      backend: {
        loadPath: path.join(__dirname, "locales", "{{lng}}", "translation.json"),
      },
      detection: {
        order: ["cookie"],
        caches: ["cookie"],
        lookupCookie: "i18next",
      },
      debug: !isProd,
      initImmediate: false,
      interpolation: { escapeValue: false },
    },
    (err, t) => {
      if (err) {
        console.error("❌ i18next init hiba:", err);
      } else {
        console.log("✅ i18next OK | minta kulcs:", t("home.title", { lng: "hu" }));
      }
    }
  );

// i18n middleware – API/auth kivételek
app.use(
  i18nextMiddleware.handle(i18next, {
    ignoreRoutes: (req) =>
      req.url.startsWith("/api") ||
      req.url.startsWith("/admin/login") ||
      req.url.startsWith("/admin/logout"),
  })
);

// ============================================================
// EJS beállítások
// ============================================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.basedir = app.get("views");

// ============================================================
// Helmet – CSP (CDN-ek engedve), dev-barát
// (Videókhoz: media-src, valamint blob: támogatás.)
// ============================================================
app.use(
  helmet({
    hsts: isProd ? undefined : false,
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "base-uri": ["'self'"],
            "object-src": ["'none'"],
            "img-src": ["'self'", "data:", "https:", "blob:"],
            "media-src": ["'self'", "blob:", "data:"],
            "font-src": [
              "'self'",
              "data:",
              "https://fonts.gstatic.com",
              "https://cdnjs.cloudflare.com",
              "https://cdn.jsdelivr.net",
            ],
            "style-src": [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
              "https://cdnjs.cloudflare.com",
              "https://cdn.jsdelivr.net",
            ],
            "script-src": [
              "'self'",
              "'unsafe-inline'",
              "https://cdn.jsdelivr.net",
              "https://cdnjs.cloudflare.com",
            ],
            "connect-src": ["'self'"],
            "frame-src": ["'self'", "https://www.google.com", "https://google.com"],
            "upgrade-insecure-requests": [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ============================================================
// Statikus fájlok, parserek, cookie, session
// ============================================================
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: isProd ? "7d" : 0,
    etag: true,
    lastModified: true,
    fallthrough: true,
    setHeaders: (res, filePath) => {
      if (/\.(mp4|webm|ogg)$/i.test(filePath) && isProd) {
        res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

if (isProd) app.set("trust proxy", 1);

app.use(
  session({
    name: "flds.sid",
    secret: process.env.SESSION_SECRET || "dev-change-me-please",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// ============================================================
// Helper függvények
// ============================================================
const setLangCookie = (res, lng) => {
  res.cookie("i18next", lng, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    sameSite: "lax",
    secure: isProd,
  });
};

const loadJSON = (publicRelPath) => {
  try {
    const fullPath = path.join(__dirname, "public", publicRelPath);
    const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    return data;
  } catch (err) {
    console.error(`❌ JSON betöltési hiba (${publicRelPath}):`, err.message);
    return null;
  }
};

const loadHeroBox = () => {
  try {
    const heroBoxPath = path.join(__dirname, "public", "hero-box.json");
    if (!fs.existsSync(heroBoxPath)) {
      const defaultHeroBox = {
        enabled: true,
        icon: "🏔️",
        title: "Aktuelles Angebot",
        description: "Genießen Sie unseren speziellen Bergblick mit 3-Gänge-Menü",
        buttonText: "Mehr erfahren",
        buttonLink: "#offers",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        priority: 1,
        isActive: true,
        targetAudience: "all",
      };
      fs.writeFileSync(heroBoxPath, JSON.stringify(defaultHeroBox, null, 2));
      console.log("✅ Alapértelmezett hero-box.json létrehozva");
      return defaultHeroBox;
    }
    const data = JSON.parse(fs.readFileSync(heroBoxPath, "utf8"));
    if (data?.endDate && new Date(data.endDate) < new Date()) data.isActive = false;
    return data;
  } catch (err) {
    console.error("❌ Hero-box betöltési hiba:", err.message);
    return { enabled: false, isActive: false };
  }
};

// ============================================================
// i18n locals + flags + egyszerű kérés-log
// ============================================================
app.use((req, res, next) => {
  res.locals.t = req.t;
  res.locals.i18n = req.i18n;

  // ← Feature-flagek SSR-hez
  res.locals.flags = {
    menuBookEnabled: !!SETTINGS.menuBookEnabled,
  };

  if (process.env.LOG_REQUESTS === "1") {
    console.log(
      "➡️",
      req.method,
      req.url,
      "| lang:",
      req.language,
      "| admin:",
      !!req.session?.isAdmin,
      "| menuBookEnabled:",
      res.locals.flags.menuBookEnabled
    );
  }
  next();
});

// ============================================================
// Nyelvváltás
// ============================================================
app.post("/change-language", (req, res) => {
  const { lang } = req.body || {};
  if (["hu", "de"].includes(lang)) {
    setLangCookie(res, lang);
    return res.json({ success: true });
  }
  res.status(400).json({ success: false, message: "Érvénytelen nyelv" });
});

app.get("/set-language/:lang", (req, res) => {
  const { lang } = req.params;
  const { admin } = req.query;
  if (!["hu", "de"].includes(lang)) return res.status(400).send("Érvénytelen nyelv");

  const wasAdmin = !!req.session.isAdmin;
  setLangCookie(res, lang);
  if (wasAdmin || admin === "true") req.session.isAdmin = true;

  req.session.save((err) => {
    if (err) console.error("❌ Session mentési hiba:", err);
    const referer = req.get("Referer") || (wasAdmin ? "/admin" : "/");
    res.redirect(referer);
  });
});

// ============================================================
// Oldalak
// ============================================================
app.get("/", (req, res) => {
  const menuData = loadJSON("menu.json");
  const openingHours = loadJSON("opening-hours.json");
  const heroBoxData = loadHeroBox();

  if (!menuData || !openingHours) {
    console.error(
      "❌ Menü vagy nyitvatartás hiányzik (public/menu.json vagy public/opening-hours.json)."
    );
    return res
      .status(500)
      .send("Server error: Menü vagy nyitvatartás adat nem található.");
  }

  const heroImages = [
    "/img/hero/feldiserhof-winter.jpg",
    "/img/hero/feldiserhof-sunset.jpg",
    "/img/hero/feldiserhof-view.jpg",
    "/img/hero/miratoedi.jpg",
    "/img/hero/IMG_0365 2.jpg",
  ];

  res.render("index", {
    title: req.t("home.title"),
    description: req.t("home.description"),
    menu: menuData,
    hours: openingHours,
    heroBox: heroBoxData,
    heroImages,
  });
});

app.get("/zimmer", (req, res) => {
  res.render("rooms", {
    title: "Unsere Zimmer im Alpenstil",
    active: "zimmer",
  });
});

app.get("/gallery", (req, res) => {
  res.render("gallery", {
    title: req.t("gallery.title"),
    description: req.t("gallery.description"),
  });
});

// Galéria API
app.get("/api/gallery", (req, res) => {
  const galleryDir = path.join(__dirname, "public", "gallery");
  const albums = {};
  try {
    if (!fs.existsSync(galleryDir)) {
      return res.status(404).json({ error: "Gallery folder not found." });
    }
    const folders = fs
      .readdirSync(galleryDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const folder of folders) {
      const folderPath = path.join(galleryDir, folder);
      const files = fs
        .readdirSync(folderPath)
        .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .map((f) => ({
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

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "development" });
});

// ============================================================
// Admin / CSRF / API-k
// ============================================================
const isAdmin = (req) => !!req.session?.isAdmin;
const requireAdmin = (req, res, next) => {
  if (!isAdmin(req)) return res.status(401).send("Unauthorized");
  next();
};

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const csrfIssue = csrf(); // session alapú
app.get("/api/csrf-token", csrfIssue, (req, res) => {
  res.json({ token: req.csrfToken() });
});

const csrfFromHeader = csrf({
  value: (req) =>
    req.get("CSRF-Token") ||
    req.body?._csrf ||
    req.get("x-csrf-token") ||
    req.get("csrf-token") ||
    "",
});

app.post("/admin/login", loginLimiter, csrfFromHeader, async (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  if (!hash) return res.status(500).json({ ok: false, msg: "Admin not configured" });

  const ok = await bcrypt.compare(String(password || ""), hash);
  if (!ok) return res.status(401).json({ ok: false, msg: "Bad credentials" });

  req.session.isAdmin = true;
  console.log("🔑 Admin bejelentkezés sikeres");
  res.json({ ok: true });
});

app.post("/admin/logout", requireAdmin, (req, res) => {
  console.log("🔓 Admin kijelentkezés");
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/admin", requireAdmin, (req, res) => {
  const heroBoxData = loadHeroBox();
  res.render("admin/dashboard", {
    title: req.t("admin.title"),
    description: req.t("admin.description"),
    heroBox: heroBoxData,
  });
});

app.get("/admin/menu", requireAdmin, (req, res) => {
  const menuData = loadJSON("menu.json");
  res.render("admin/menu-editor", {
    title: req.t("admin.menuEditor"),
    description: req.t("admin.menuEditorDesc"),
    menu: menuData,
  });
});

// 🔹🔹🔹 ÚJ: Feature-Schalter oldal route (Mitarbeitende) 🔹🔹🔹
app.get("/admin/mitarbeitende", requireAdmin, (req, res) => {
  res.render("admin/mitarbeitende", {
    title: "Feature-Schalter",
    description: "Interne Einstellungen",
    // flags SSR-ben már mennek res.locals-ból, de adhatsz dedikáltat is:
    flags: { menuBookEnabled: !!SETTINGS.menuBookEnabled },
  });
});
// 🔹🔹🔹 /ÚJ 🔹🔹🔹

// Menü API
app.get("/api/menu", requireAdmin, (req, res) => {
  const data = loadJSON("menu.json");
  res.json(data || { title: "", categories: [] });
});

app.post("/api/menu", requireAdmin, (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : null;
  if (!body) return res.status(400).json({ ok: false, msg: "Invalid body" });
  try {
    const fullPath = path.join(__dirname, "public", "menu.json");
    fs.writeFileSync(fullPath, JSON.stringify(body, null, 2), "utf8");
    console.log("✅ Menü mentve:", fullPath);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Menü mentési hiba:", e);
    res.status(500).json({ ok: false, msg: "Save failed" });
  }
});

// Hero Box API
app.get("/api/hero-box", requireAdmin, (req, res) => {
  const data = loadHeroBox();
  res.json(data || {});
});

app.post("/api/hero-box", requireAdmin, (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : null;
  if (!body) return res.status(400).json({ ok: false, msg: "Invalid body" });

  try {
    const fullPath = path.join(__dirname, "public", "hero-box.json");
    fs.writeFileSync(fullPath, JSON.stringify(body, null, 2), "utf8");
    console.log("✅ Hero-box frissítve");
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Hero-box mentési hiba:", e);
    res.status(500).json({ ok: false, msg: "Save failed" });
  }
});

// ===== Feature Flags API =====
app.get("/api/feature-flags", (req, res) => {
  res.json({ menuBookEnabled: !!SETTINGS.menuBookEnabled });
});

app.post("/admin/feature-flags/menu-book", requireAdmin, (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ ok: false, msg: "enabled must be boolean" });
  }
  SETTINGS.menuBookEnabled = enabled;
  writeSettings(SETTINGS);
  console.log("🛠️ menuBookEnabled →", enabled);
  res.json({ ok: true, menuBookEnabled: !!SETTINGS.menuBookEnabled });
});

// CSRF hibakezelő
app.use((err, req, res, next) => {
  if (err && err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ ok: false, msg: "Invalid CSRF token" });
  }
  next(err);
});

// Általános 500-as hibakezelő (fallback)
app.use((err, _req, res, _next) => {
  console.error("💥 Váratlan hiba:", err);
  res.status(500).send("Internal Server Error");
});

// ============================================================
// 404
// ============================================================
app.use((req, res) => {
  res.status(404).send(req.t("errors.404"));
});

// ============================================================
// Start
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Feldiserhof szerver fut: http://localhost:${PORT}`);
  console.log(`🌐 Nyelvi támogatás: hu, de`);
  console.log(`🔐 Admin: /admin`);
  console.log(`📝 Menü szerkesztő: /admin/menu`);
  console.log(`🎯 Hero Box: aktív`);
  console.log("📁 Feature flags fájl:", SETTINGS_PATH);
  console.log("⚙️  menuBookEnabled:", SETTINGS.menuBookEnabled);
  console.log("🛏  Rooms: beépített EJS tartalom (nincs rooms.json).");
});
