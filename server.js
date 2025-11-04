// ============================================================
// Feldiserhof – Express.js szerver (admin-ready + Wellness + Rooms)
// + Feature Flag: "menuBookEnabled" (könyv nyithatóság adminból)
// ============================================================
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import csrf from 'csurf';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ============================================================
// Konzol header
// ============================================================
console.log('===============================================');
console.log('🚀 Feldiserhof szerver indul...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV || '(nincs megadva)');
console.log('===============================================');

// ============================================================
// Feature flags – perzisztens tárolás
// ============================================================
const DATA_DIR = path.join(__dirname, 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      const defaults = { menuBookEnabled: true };
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaults, null, 2), 'utf8');
      console.log('✅ Alapértelmezett settings.json létrehozva');
      return defaults;
    }
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (e) {
    console.error('❌ Settings betöltési hiba:', e.message);
    return { menuBookEnabled: true };
  }
}
function writeSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Settings mentési hiba:', e.message);
  }
}
let SETTINGS = readSettings();

// ============================================================
// EJS beállítások + view-helpek
// ============================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.basedir = app.get('views');

// Cache-buster minden nézethez (head.ejs: ?v=<%= v %>)
app.use((req, res, next) => {
  res.locals.v = Date.now();
  next();
});

// Helper: csak létező assetet engedünk a view-ban (Chrome <picture> fallback fix)
app.locals.assetIfExists = (relPath) => {
  try {
    const p = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    return fs.existsSync(path.join(__dirname, 'public', p)) ? relPath : null;
  } catch {
    return null;
  }
};

// ============================================================
// Helmet – CSP (CDN-ek engedve), dev-barát
// ============================================================
app.use(
  helmet({
    hsts: isProd ? undefined : false,
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            'default-src': ["'self'"],
            'base-uri': ["'self'"],
            'object-src': ["'none'"],
            'img-src': ["'self'", 'data:', 'https:', 'blob:'],
            'media-src': ["'self'", 'blob:', 'data:'],
            'font-src': [
              "'self'",
              'data:',
              'https://fonts.gstatic.com',
              'https://cdnjs.cloudflare.com',
              'https://cdn.jsdelivr.net',
            ],
            'style-src': [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
              'https://cdnjs.cloudflare.com',
              'https://cdn.jsdelivr.net',
            ],
            'script-src': [
              "'self'",
              "'unsafe-inline'",
              'https://cdn.jsdelivr.net',
              'https://cdnjs.cloudflare.com',
            ],
            'connect-src': ["'self'"],
            'frame-src': ["'self'", 'https://www.google.com', 'https://google.com'],
            'upgrade-insecure-requests': [],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// ============================================================
// Statikus fájlok – egységes kiszolgálás
// ============================================================
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '30d' : 0,
    etag: true,
    lastModified: true,
    fallthrough: true,
    setHeaders(res, filePath) {
      if (/\.avif$/i.test(filePath)) res.type('image/avif');
      else if (/\.webp$/i.test(filePath)) res.type('image/webp');
      else if (/\.(jpe?g)$/i.test(filePath)) res.type('image/jpeg');
      else if (/\.png$/i.test(filePath)) res.type('image/png');
      else if (/\.gif$/i.test(filePath)) res.type('image/gif');
      else if (/\.svg$/i.test(filePath)) res.type('image/svg+xml');
      else if (/\.ico$/i.test(filePath)) res.type('image/x-icon');

      if (isProd && /\.(?:avif|webp|jpe?g|png|gif|svg|woff2?|css|js)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      if (isProd && /\.(mp4|webm|ogg)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      }
    },
  }),
);

// ============================================================
/** Parserek, cookie, session */
// ============================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
if (isProd) app.set('trust proxy', 1);

app.use(
  session({
    name: 'flds.sid',
    secret: process.env.SESSION_SECRET || 'dev-change-me-please',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

// ============================================================
// Helper függvények
// ============================================================
const loadJSON = (publicRelPath) => {
  try {
    const fullPath = path.join(__dirname, 'public', publicRelPath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (err) {
    console.error(`❌ JSON betöltési hiba (${publicRelPath}):`, err.message);
    return null;
  }
};

const loadDataJSON = (dataRelPath) => {
  try {
    const fullPath = path.join(__dirname, 'data', dataRelPath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Data JSON betöltési hiba (${dataRelPath}):`, err.message);
    return null;
  }
};

const loadHeroBox = () => {
  try {
    const heroBoxPath = path.join(__dirname, 'public', 'hero-box.json');
    if (!fs.existsSync(heroBoxPath)) {
      const defaultHeroBox = {
        enabled: true,
        icon: '🏔️',
        title: 'Aktuelles Angebot',
        description: 'Genießen Sie unseren speziellen Bergblick mit 3-Gänge-Menü',
        buttonText: 'Mehr erfahren',
        buttonLink: '#offers',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 1,
        isActive: true,
        targetAudience: 'all',
      };
      fs.writeFileSync(heroBoxPath, JSON.stringify(defaultHeroBox, null, 2));
      console.log('✅ Alapértelmezett hero-box.json létrehozva');
      return defaultHeroBox;
    }
    const data = JSON.parse(fs.readFileSync(heroBoxPath, 'utf8'));
    if (data?.endDate && new Date(data.endDate) < new Date()) data.isActive = false;
    return data;
  } catch (err) {
    console.error('❌ Hero-box betöltési hiba:', err.message);
    return { enabled: false, isActive: false };
  }
};

// ============================================================
// „i18n locals” helyett egyszerű flags + debug log
// ============================================================
app.use((req, res, next) => {
  // Ha bárhol EJS-ben maradt volna <%= t('kulcs') %>, ne dőljön el az oldal:
  res.locals.t = (key) => key;
  res.locals.i18n = null;
  res.locals.flags = { menuBookEnabled: !!SETTINGS.menuBookEnabled };

  if (process.env.LOG_REQUESTS === '1') {
    console.log(
      '➡️',
      req.method,
      req.url,
      '| admin:',
      !!req.session?.isAdmin,
      '| menuBookEnabled:',
      res.locals.flags.menuBookEnabled,
    );
  }
  next();
});

// ============================================================
// Oldalak
// ============================================================
app.get('/', (req, res) => {
  const menuData = loadJSON('menu.json');
  const openingHours = loadJSON('opening-hours.json');
  const heroBoxData = loadHeroBox();

  if (!menuData || !openingHours) {
    console.error(
      '❌ Menü vagy nyitvatartás hiányzik (public/menu.json vagy public/opening-hours.json).',
    );
    return res.status(500).send('Server error: Menü vagy nyitvatartás adat nem található.');
  }

  const heroImages = [
    '/img/hero/feldiserhof-winter.jpg',
    '/img/hero/feldiserhof-sunset.jpg',
    '/img/hero/feldiserhof-view.jpg',
    '/img/hero/miratoedi.jpg',
    '/img/hero/IMG_03652.jpg',
  ];

  res.render(
    'index',
    {
      title: 'Feldiserhof – Hotel & Restaurant',
      description: 'Hotel, Restaurant & Café Feldis – feine Küche, regionale Zutaten, kleine Wellness-Oase.',
      menu: menuData,
      hours: openingHours,
      heroBox: heroBoxData,
      heroImages,
    },
    (err, html) => {
      if (err) {
        console.error('💥 EJS render hiba az index.ejs-ben:', err);
        return res.status(500).send('Template render error');
      }
      res.send(html);
    },
  );
});

app.get('/zimmer', (req, res) => {
  const roomsData = loadDataJSON('rooms.json');

  if (!roomsData) {
    console.error('❌ rooms.json hiányzik (data/rooms.json)');
    return res.status(500).send('Server error: Szobák adat nem található.');
  }

  res.render(
    'rooms',
    {
      title: 'Unsere Zimmer im Alpenstil',
      active: 'zimmer',
      rooms: roomsData,
    },
    (err, html) => {
      if (err) {
        console.error('💥 EJS render hiba a rooms.ejs-ben:', err);
        return res.status(500).send('Template render error');
      }
      res.send(html);
    },
  );
});

app.get('/gallery', (req, res) => {
  res.render(
    'gallery',
    {
      title: 'Galerie – Feldiserhof',
      description: 'Einblick in unser Hotel, Restaurant und den Wellnessbereich.',
    },
    (err, html) => {
      if (err) {
        console.error('💥 EJS render hiba a gallery.ejs-ben:', err);
        return res.status(500).send('Template render error');
      }
      res.send(html);
    },
  );
});

// Galéria API
app.get('/api/gallery', (req, res) => {
  const galleryDir = path.join(__dirname, 'public', 'gallery');
  const albums = {};
  try {
    if (!fs.existsSync(galleryDir)) {
      return res.status(404).json({ error: 'Gallery folder not found.' });
    }
    const folders = fs
      .readdirSync(galleryDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const folder of folders) {
      const folderPath = path.join(galleryDir, folder);
      const files = fs
        .readdirSync(folderPath)
        .filter((f) => /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f))
        .map((f) => ({
          src: `/gallery/${folder}/${f}`,
          alt: `${folder} – ${f.replace(/\.[^/.]+$/, '')}`,
        }));
      albums[folder] = files;
    }
    res.json({ albums });
  } catch (err) {
    console.error('❌ Galéria betöltési hiba:', err);
    res.status(500).json({ error: 'Failed to load gallery.' });
  }
});

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// ============================================================
// PUBLIKUS Hero Box API (főoldalhoz)
// ============================================================
app.get('/api/hero-box', (req, res) => {
  const data = loadHeroBox();
  res.json(data || {});
});

// ============================================================
// Admin / CSRF / API-k
// ============================================================
const isAdmin = (req) => !!req.session?.isAdmin;
const requireAdmin = (req, res, next) => {
  if (!isAdmin(req)) return res.status(401).send('Unauthorized');
  next();
};

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// CSRF middleware (session alapú)
const csrfProtection = csrf({ cookie: false });

const csrfFromHeader = csrf({
  value: (req) =>
    req.get('CSRF-Token') ||
    req.body?._csrf ||
    req.get('x-csrf-token') ||
    req.get('csrf-token') ||
    '',
  cookie: false,
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ token: req.csrfToken() });
});

app.post('/admin/login', loginLimiter, csrfFromHeader, async (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH || '';
  if (!hash) return res.status(500).json({ ok: false, msg: 'Admin not configured' });

  const ok = await bcrypt.compare(String(password || ''), hash);
  if (!ok) return res.status(401).json({ ok: false, msg: 'Bad credentials' });
  req.session.isAdmin = true;
  console.log('🔑 Admin bejelentkezés sikeres');
  res.json({ ok: true });
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  console.log('🔓 Admin kijelentkezés');
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/admin', requireAdmin, (req, res) => {
  const heroBoxData = loadHeroBox();
  res.render('admin/dashboard', {
    title: 'Admin-Dashboard – Feldiserhof',
    description: 'Administrationsbereich der Feldiserhof-Website',
    heroBox: heroBoxData,
    csrfToken: req.csrfToken ? req.csrfToken() : '',
  });
});

app.get('/admin/menu', requireAdmin, csrfProtection, (req, res) => {
  const menuData = loadJSON('menu.json');
  res.render('admin/menu-editor', {
    title: 'Speisekarte bearbeiten',
    description: 'Speisen, Getränke und Kategorien verwalten, Preise aktualisieren.',
    menu: menuData,
    csrfToken: req.csrfToken(),
  });
});

// Feature-Schalter oldal
app.get('/admin/mitarbeitende', requireAdmin, csrfProtection, (req, res) => {
  res.render('admin/mitarbeitende', {
    title: 'Feature-Schalter',
    description: 'Interne Einstellungen',
    flags: { menuBookEnabled: !!SETTINGS.menuBookEnabled },
    csrfToken: req.csrfToken(),
  });
});

// Menü API
app.get('/api/menu', requireAdmin, (req, res) => {
  const data = loadJSON('menu.json');
  res.json(data || { title: '', categories: [] });
});

app.post('/api/menu', requireAdmin, csrfFromHeader, (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) return res.status(400).json({ ok: false, msg: 'Invalid body' });
  try {
    const fullPath = path.join(__dirname, 'public', 'menu.json');
    fs.writeFileSync(fullPath, JSON.stringify(body, null, 2), 'utf8');
    console.log('✅ Menü mentve:', fullPath);
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Menü mentési hiba:', e);
    res.status(500).json({ ok: false, msg: 'Save failed' });
  }
});

// ADMIN Hero Box API (szerkesztéshez)
app.get('/admin/api/hero-box', requireAdmin, (req, res) => {
  const data = loadHeroBox();
  res.json(data || {});
});

app.post('/admin/api/hero-box', requireAdmin, csrfFromHeader, (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) return res.status(400).json({ ok: false, msg: 'Invalid body' });

  try {
    const fullPath = path.join(__dirname, 'public', 'hero-box.json');
    fs.writeFileSync(fullPath, JSON.stringify(body, null, 2), 'utf8');
    console.log('✅ Hero-box frissítve');
    res.json({ ok: true });
  } catch (e) {
    console.error('❌ Hero-box mentési hiba:', e);
    res.status(500).json({ ok: false, msg: 'Save failed' });
  }
});

// ===== Feature Flags API =====
app.get('/api/feature-flags', (req, res) => {
  res.json({ menuBookEnabled: !!SETTINGS.menuBookEnabled });
});

app.post('/admin/feature-flags/menu-book', requireAdmin, csrfProtection, (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ ok: false, msg: 'enabled must be boolean' });
  }
  SETTINGS.menuBookEnabled = enabled;
  writeSettings(SETTINGS);
  console.log('🛠️ menuBookEnabled →', enabled);
  res.json({ ok: true, menuBookEnabled: !!SETTINGS.menuBookEnabled });
});

// ===== Védelem: régi menu.js alias az újra =====
app.get('/js/menu.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'js', 'menu-portfolio-book.js'));
});

// ============================================================
// Hibakezelés
// ============================================================
const csrfErrorHandler = (err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ ok: false, msg: 'Invalid CSRF token' });
  }
  return next(err);
};
app.use(csrfErrorHandler);

app.use((err, _req, res, _next) => {
  console.error('💥 Váratlan hiba:', err);
  res.status(500).send('Internal Server Error');
});

// 404
app.use((req, res) => {
  res.status(404).send('404 – Seite nicht gefunden.');
});

// ============================================================
// Start
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Feldiserhof szerver fut: http://localhost:${PORT}`);
  console.log(`🌐 Nyelvi támogatás: statische DE-Texte (i18n nélkül)`);
  console.log(`🔐 Admin: /admin`);
  console.log(`📝 Menü szerkesztő: /admin/menu`);
  console.log(`🎯 Hero Box: aktív`);
  console.log('📁 Feature flags fájl:', SETTINGS_PATH);
  console.log('⚙️  menuBookEnabled:', SETTINGS.menuBookEnabled);
  console.log('🛏  Rooms: data/rooms.json betöltve.');
});
