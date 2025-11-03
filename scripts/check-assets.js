import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const publicDir = path.join(root, 'public');
const viewDir = path.join(root, 'views');

const fileList = [];
function walk(dir, exts) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, exts);
    else if (exts.some((e) => p.endsWith(e))) fileList.push(p);
  }
}

walk(viewDir, ['.ejs', '.html']);
walk(path.join(root, 'public', 'css'), ['.css', '.map']);

const assetRefs = new Set();
const refRe = /(?:src|href|url)\((?:'|")?([^'"()]+)(?:'|")?\)|(?:src|href)=["']([^"']+)["']/gi;

for (const f of fileList) {
  const c = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = refRe.exec(c))) {
    const candidate = (m[1] || m[2] || '').trim();
    if (!candidate) continue;
    if (
      candidate.startsWith('http') ||
      candidate.startsWith('mailto:') ||
      candidate.startsWith('#')
    )
      continue;
    if (candidate.startsWith('data:')) continue;
    assetRefs.add(candidate);
  }
}

const missing = [];
for (const ref of assetRefs) {
  const clean = ref.split('?')[0];
  const disk = path.join(publicDir, clean.startsWith('/') ? clean.slice(1) : clean);
  if (!fs.existsSync(disk)) missing.push({ ref, disk });
}

if (missing.length) {
  console.error('❌ Hiányzó assetek:');
  for (const m of missing) console.error(` - ${m.ref}  →  ${m.disk}`);
  process.exitCode = 1;
} else {
  console.log('✅ Minden hivatkozott asset megtalálható.');
}
