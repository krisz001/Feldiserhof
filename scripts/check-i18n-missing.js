import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const locales = ['hu', 'de'];
const keys = new Set();

// 1) gyűjtjük a t('...') és T('...') hívások kulcsait
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ejs|js|ts)$/.test(p)) {
      const c = fs.readFileSync(p, 'utf8');
      const re = /\b[ tT]\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(c))) keys.add(m[1]);
    }
  }
}
walk(path.join(root, 'views'));
walk(path.join(root, 'public', 'js'));
walk(root); // server.js

// 2) összevetjük a locales JSON-okkal
let exit = 0;
for (const lng of locales) {
  const f = path.join(root, 'locales', lng, 'translation.json');
  if (!fs.existsSync(f)) continue;
  const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
  const flat = {};
  (function flatten(o, prefix = '') {
    for (const [k, v] of Object.entries(o)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') flatten(v, key);
      else flat[key] = true;
    }
  })(obj);

  const missing = [];
  for (const k of keys) if (!flat[k]) missing.push(k);
  if (missing.length) {
    exit = 1;
    console.error(`❌ Hiányzó fordítások (${lng}):`);
    for (const k of missing) console.error(' -', k);
  } else {
    console.log(`✅ ${lng}: nincs hiányzó kulcs.`);
  }
}
process.exitCode = exit;
