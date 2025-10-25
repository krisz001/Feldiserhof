// ============================================================
// Feldiserhof – Express.js szerver (bővített, admin-ready + Hero Box)
// ============================================================
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Biztonság + admin csomagok
import dotenv from "dotenv";
import session from "express-session";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import csrf from "csurf";
import rateLimit from "express-rate-limit";

// Nyelvi támogatás
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import i18nextMiddleware from 'i18next-http-middleware';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

// ============================================================
// DEBUG: Nyelvi fájlok ellenőrzése
// ============================================================
console.log('🔍 Nyelvi fájlok ellenőrzése:');
const huPath = path.join(__dirname, 'locales', 'hu', 'translation.json');
const dePath = path.join(__dirname, 'locales', 'de', 'translation.json');
console.log('HU fájl:', huPath, '- Létezik:', fs.existsSync(huPath));
console.log('DE fájl:', dePath, '- Létezik:', fs.existsSync(dePath));

// ============================================================
// i18next inicializálás - JAVÍTOTT (csak cookie detektálás)
// ============================================================
await i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    fallbackLng: 'hu',
    preload: ['hu', 'de'],
    backend: {
      loadPath: path.join(__dirname, 'locales', '{{lng}}', 'translation.json')
    },
    detection: {
      order: ['cookie'],            // ← csak cookie
      caches: ['cookie'],
      lookupCookie: 'i18next'
    },
    debug: true,
    initImmediate: false
  }, (err, t) => {
    if (err) {
      console.error('❌ i18next inicializálási hiba:', err);
    } else {
      console.log('✅ i18next sikeresen inicializálva');
      console.log('🌐 Alapértelmezett nyelv minta (hu):', t('home.title', { lng: 'hu' }));
    }
  });

// i18n middleware – API-k és auth végpontok ignorálása
app.use(i18nextMiddleware.handle(i18next, {
  ignoreRoutes: (req) => (
    req.url.startsWith('/api') ||
    req.url.startsWith('/admin/login') ||
    req.url.startsWith('/admin/logout')
  )
}));

// ============================================================
// Alapbeállítások
// ============================================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.basedir = app.get("views");

// ============================================================
// Helmet – DEV/PROD barát beállítás
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
            "img-src": ["'self'", "data:", "https:"],
            "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
            "style-src": [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
              "https://cdnjs.cloudflare.com",
              "https://cdn.jsdelivr.net"
            ],
            "script-src": [
              "'self'",
              "'unsafe-inline'",
              "https://cdn.jsdelivr.net",
              "https://cdnjs.cloudflare.com"
            ],
            "connect-src": ["'self'"],
            "frame-src": ["'self'", "https://www.google.com", "https://google.com"]
          }
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// ============================================================
// Statikus fájlok
// ============================================================
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// Body parse + session
// ============================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

if (isProd) {
  // reverse proxy / HTTPS mögött kötelező a secure cookie-hoz
  app.set("trust proxy", 1);
}

app.use(
  session({
    name: "flds.sid",
    secret: process.env.SESSION_SECRET || "dev-change-me-please",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,                    // ← prodban secure
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// ============================================================
// Nyelvi helper a stabil cookie-hoz (1 év, secure prodban)
// ============================================================
const setLangCookie = (res, lng) => {
  res.cookie('i18next', lng, {
    maxAge: 365 * 24 * 60 * 60 * 1000,   // 1 év
    httpOnly: false,                     // kliens JS olvashatja (pl. i18next browser)
    sameSite: 'lax',
    secure: isProd
  });
};

// ============================================================
// Helper: JSON olvasás
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
// Helper: Hero Box adatok betöltése
// ============================================================
const loadHeroBox = () => {
  try {
    const heroBoxPath = path.join(__dirname, "public", "hero-box.json");
    
    // Ha nem létezik a fájl, alapértelmezett értékekkel létrehozzuk
    if (!fs.existsSync(heroBoxPath)) {
      const defaultHeroBox = {
        enabled: true,
        icon: "🏔️",
        title: "Aktuelles Angebot",
        description: "Genießen Sie unseren speziellen Bergblick mit 3-Gänge-Menü",
        buttonText: "Mehr erfahren",
        buttonLink: "#offers",
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 1,
        isActive: true,
        targetAudience: "all"
      };
      
      fs.writeFileSync(heroBoxPath, JSON.stringify(defaultHeroBox, null, 2));
      console.log('✅ Alapértelmezett hero-box.json létrehozva');
      return defaultHeroBox;
    }
    
    const data = JSON.parse(fs.readFileSync(heroBoxPath, "utf8"));
    
    // Dátum érvényesség ellenőrzése
    const now = new Date();
    const endDate = new Date(data.endDate);
    if (endDate < now) {
      data.isActive = false;
    }
    
    return data;
  } catch (err) {
    console.error('❌ Hiba a hero-box.json betöltésekor:', err.message);
    return {
      enabled: false,
      icon: "🏔️",
      title: "Aktuelles Angebot",
      description: "Genießen Sie unseren speziellen Bergblick mit 3-Gänge-Menü",
      buttonText: "Mehr erfahren",
      buttonLink: "#offers",
      isActive: false
    };
  }
};

// ============================================================
// Nyelvi middleware - DEBUG információkkal
// ============================================================
app.use((req, res, next) => {
  res.locals.t = req.t;
  res.locals.i18n = req.i18n;

  console.log('🌐 Kérés érkezett:', {
    url: req.url,
    language: req.language,
    languages: req.languages,
    sessionAdmin: req.session?.isAdmin
  });

  next();
});

// ============================================================
// Nyelv váltó route - POST (JavaScript-hez)
// ============================================================
app.post('/change-language', (req, res) => {
  const { lang } = req.body;
  console.log('🔄 POST nyelvváltás kérés:', lang);

  if (['hu', 'de'].includes(lang)) {
    setLangCookie(res, lang);                    // ← egységes helper
    res.json({ success: true, message: 'Nyelv megváltoztatva' });
  } else {
    res.status(400).json({ success: false, message: 'Érvénytelen nyelv' });
  }
});

// ============================================================
// NYELVVÁLTÓ GET ROUTE-OK - JAVÍTOTT (SESSION MEGŐRZÉSSEL)
// ============================================================
app.get('/set-language/:lang', (req, res) => {
  const { lang } = req.params;
  const { admin } = req.query;

  console.log('🔄 GET nyelvváltás kérés:', { lang, admin, referer: req.get('Referer') });

  if (!['hu', 'de'].includes(lang)) {
    return res.status(400).send('Érvénytelen nyelv');
  }

  const wasAdmin = !!req.session.isAdmin;
  setLangCookie(res, lang);                      // ← egységes helper

  if (wasAdmin || admin === 'true') {
    req.session.isAdmin = true;
    console.log('🔐 Admin session megőrizve');
  }

  req.session.save((err) => {
    if (err) console.error('❌ Session mentési hiba:', err);
    const referer = req.get('Referer') || (wasAdmin ? '/admin' : '/');
    console.log('↪️ Átirányítás:', referer);
    res.redirect(referer);
  });
});

// ============================================================
// Főoldal - HERO BOX támogatással
// ============================================================
app.get("/", (req, res) => {
  console.log('🏠 Főoldal betöltése, nyelv:', req.language);

  const menuData = loadJSON("menu.json");
  const openingHours = loadJSON("opening-hours.json");
  const heroBoxData = loadHeroBox();

  if (!menuData || !openingHours) {
    console.error("❌ Menü vagy nyitvatartás adat nem található.");
    return res.status(500).send("Server error: Menü vagy nyitvatartás adat nem található.");
  }

  // Hero képek tömbje
  const heroImages = [
    '/img/hero/feldiserhof-winter.jpg',
    '/img/hero/feldiserhof-sunset.jpg',
    '/img/hero/feldiserhof-view.jpg'
  ];

  res.render("index", {
    title: req.t('home.title'),
    description: req.t('home.description'),
    menu: menuData,
    hours: openingHours,
    heroBox: heroBoxData,
    heroImages: heroImages
  });
});

// ============================================================
// Galéria oldal
// ============================================================
app.get("/gallery", (req, res) => {
  console.log('🖼️ Galéria oldal betöltése, nyelv:', req.language);

  res.render("gallery", {
    title: req.t('gallery.title'),
    description: req.t('gallery.description')
  });
});

// ============================================================
// Galéria API – albumosított olvasás (public/gallery/...)
// ============================================================
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
          alt: `${folder} – ${f.replace(/\.[^/.]+$/, "")}`
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
// Rejtett admin + Menü CRUD alap + HERO BOX API
// ============================================================
const isAdmin = (req) => !!req.session?.isAdmin;
const requireAdmin = (req, res, next) => {
  if (!isAdmin(req)) {
    console.log('🚫 Admin jogosultság hiányzik, session:', req.session);
    return res.status(401).send("Unauthorized");
  }
  next();
};

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// ---- CSRF beállítások ----
const csrfIssue = csrf();
app.get("/api/csrf-token", csrfIssue, (req, res) => {
  res.json({ token: req.csrfToken() });
});

const csrfFromHeader = csrf({
  value: (req) =>
    req.get("CSRF-Token") ||
    req.body?._csrf ||
    req.get("x-csrf-token") ||
    req.get("csrf-token") ||
    ""
});

// ---- Login / Logout / Admin ----
app.post("/admin/login", loginLimiter, csrfFromHeader, async (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  if (!hash) return res.status(500).json({ ok: false, msg: "Admin not configured" });

  const ok = await bcrypt.compare(String(password || ""), hash);
  if (!ok) return res.status(401).json({ ok: false, msg: "Bad credentials" });

  req.session.isAdmin = true;
  console.log('🔑 Admin bejelentkezés sikeres');
  res.json({ ok: true });
});

app.post("/admin/logout", requireAdmin, (req, res) => {
  console.log('🔓 Admin kijelentkezés');
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/admin", requireAdmin, (req, res) => {
  console.log('👑 Admin dashboard betöltése, nyelv:', req.language);

  const heroBoxData = loadHeroBox();
  
  res.render("admin/dashboard", {
    title: req.t('admin.title'),
    description: req.t('admin.description'),
    heroBox: heroBoxData
  });
});

// ---- Menü szerkesztő oldal ----
app.get("/admin/menu", requireAdmin, (req, res) => {
  console.log('📝 Admin menü szerkesztő betöltése, nyelv:', req.language);

  const menuData = loadJSON("menu.json");
  
  res.render("admin/menu-editor", {
    title: req.t('admin.menuEditor'),
    description: req.t('admin.menuEditorDesc'),
    menu: menuData
  });
});

// ---- Menü API ----
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
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Menü mentési hiba:", e);
    res.status(500).json({ ok: false, msg: "Save failed" });
  }
});

// ---- HERO BOX API ----
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
    console.log('✅ Hero box sikeresen frissítve');
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Hero box mentési hiba:", e);
    res.status(500).json({ ok: false, msg: "Save failed" });
  }
});

// ---- CSRF hibakezelő ----
app.use((err, req, res, next) => {
  if (err && err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ ok: false, msg: "Invalid CSRF token" });
  }
  next(err);
});

// ============================================================
// 404 - MINDIG AZ UTOLSÓ ROUTE!
// ============================================================
app.use((req, res) => {
  res.status(404).send(req.t('errors.404'));
});

// ============================================================
// Start
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Feldiserhof szerver fut: http://localhost:${PORT}`);
  console.log(`🌐 Nyelvi támogatás: hu, de`);
  console.log(`🔐 Admin felület: /admin`);
  console.log(`📝 Menü szerkesztő: /admin/menu`);
  console.log(`🎯 Hero Box támogatás: aktív`);
});