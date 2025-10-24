/* ===== Allergén ikonok ===== */
const allergenIcons = {
  gluten: "🌾",
  crustaceans: "🦐",
  egg: "🥚",
  fish: "🐟",
  peanuts: "🥜",
  soy: "🌱",
  milk: "🥛",
  nuts: "🌰",
  celery: "🌿",
  mustard: "🌼",
  sesame: "⚪",
  sulfite: "🧪",
  lupin: "🌸",
  molluscs: "🦪"
};

let allMenuItems = [];

/* ===== Betöltés + render ===== */
async function loadMenu() {
  try {
    // JAVÍTVA: helyes útvonal
    const res = await fetch("/menu.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const menuData = await res.json();

    // JAVÍTVA: Admin-kompatibilis formátum feldolgozása
    processMenuData(menuData);
    
    console.log("[menu] betöltve:", allMenuItems.length, "tétel", allMenuItems);
    renderBook();
    setBookTitle(0);
  } catch (e) {
    console.error("Menü betöltési hiba:", e);
    const starters = document.getElementById("page-starters");
    if (starters) {
      starters.innerHTML = `
        <div class="alert alert-danger">
          Nem sikerült betölteni a menüt. Kérjük, próbálja újra később.
        </div>`;
    }
  }
}

/* ===== Admin formátum feldolgozása ===== */
function processMenuData(menuData) {
  allMenuItems = [];
  
  if (!menuData || !menuData.categories) return;
  
  menuData.categories.forEach(category => {
    const categoryName = category.name;
    
    if (category.items && Array.isArray(category.items)) {
      category.items.forEach(item => {
        // Átalakítás a flipbook formátumra
        allMenuItems.push({
          category: mapCategory(categoryName),
          title: item.name || '',
          desc: item.description || '',
          price: parseFloat(item.price) || 0,
          image: '/img/menu/placeholder.jpg', // alapértelmezett kép
          allergens: item.allergens || []
        });
      });
    }
  });
}

/* ===== Kategória leképezés admin → flipbook ===== */
function mapCategory(categoryName) {
  const name = String(categoryName || "").toLowerCase();
  
  if (name.includes('vorspeis') || name.includes('starter') || name.includes('előétel')) {
    return "starters";
  }
  if (name.includes('haupt') || name.includes('main') || name.includes('főétel')) {
    return "mains";
  }
  if (name.includes('dessert') || name.includes('nachspeis') || name.includes('édesség')) {
    return "desserts";
  }
  if (name.includes('getränk') || name.includes('drink') || name.includes('ital')) {
    return "drinks";
  }
  
  return "mains"; // alapértelmezett
}

/* ===== kategória normalizáló ===== */
function normalizeCategory(c) {
  const v = String(c || "").toLowerCase().trim();
  if (["starters", "starter", "vorspeise", "vorspeisen", "appetizer"].includes(v)) return "starters";
  if (["mains", "main", "hauptgericht", "hauptgerichte", "plate"].includes(v)) return "mains";
  if (["dessert", "desserts", "nachspeise", "nachspeisen", "sweets"].includes(v)) return "desserts";
  if (["drinks", "getränke", "drink", "italok"].includes(v)) return "drinks";
  return v;
}

/* Egy tétel kártyájának HTML-je */
function itemCardHTML(item) {
  const allergens = Array.isArray(item.allergens) ? item.allergens : [];
  const allergensHtml = allergens.map(a =>
    `<span class="allergen-icon" title="${a}">${allergenIcons[a] || "❓"}</span>`
  ).join("");

  const price = (item.price != null && !Number.isNaN(Number(item.price)))
    ? `Fr. ${Number(item.price).toFixed(2)}`
    : "";

  const badge = item.badge
    ? `<span class="badge bg-warning-subtle text-dark">${escapeHtml(item.badge)}</span>`
    : "";

  const desc = item.desc ? String(item.desc) : "";

  return `
    <div class="card menu-item">
      <img src="${item.image}" class="card-img-top" alt="${escapeHtml(item.title || "")}"
           onerror="this.src='/img/menu/placeholder.jpg'">
      <div class="card-body">
        <h5 class="card-title mb-1">${escapeHtml(item.title || "")}</h5>
        <p class="text-muted small mb-2">${escapeHtml(desc)}</p>
        <div class="d-flex justify-content-between align-items-center">
          <span class="fw-bold">${price}</span>
          ${badge}
        </div>
        ${allergens.length ? `
        <div class="mt-3">
          <small class="text-muted d-block mb-1">Allergene:</small>
          <div class="d-flex gap-2">${allergensHtml}</div>
        </div>` : ""}
      </div>
    </div>`;
}

/* Könyv feltöltése kategóriák szerint */
function renderBook() {
  const containers = {
    starters: document.getElementById("page-starters"),
    mains:    document.getElementById("page-mains"),
    desserts: document.getElementById("page-desserts"),
    drinks:   document.getElementById("page-drinks")
  };

  // ha bármelyik hiányzik, ne folytassuk
  if (!containers.starters || !containers.mains || !containers.desserts) {
    console.warn("[menu] hiányzó konténer(ek):", containers);
    return;
  }

  Object.values(containers).forEach(el => { if(el) el.innerHTML = ""; });

  let counts = { starters:0, mains:0, desserts:0, drinks:0 };

  allMenuItems.forEach(item => {
    const key = normalizeCategory(item.category);
    const target = containers[key];
    if (target) {
      target.insertAdjacentHTML("beforeend", itemCardHTML(item));
      counts[key]++;
    }
  });

  // üres oldal jelzés
  Object.entries(containers).forEach(([key, el]) => {
    if (el && !counts[key]) {
      el.innerHTML = `
        <div class="alert alert-light border">
          Jelenleg nincs tétel ebben a kategóriában.
        </div>`;
    }
  });

  console.log("[menu] oldalankénti darab:", counts);
}

/* ===== Flipbook vezérlés ===== */
function initFlipbook() {
  const book   = document.getElementById('book');
  if (!book) return;

  const pages  = Array.from(book.querySelectorAll('.page'));
  const prev   = document.querySelector('.book-btn.prev');
  const next   = document.querySelector('.book-btn.next');
  const dots   = Array.from(document.querySelectorAll('.book-dots .dot'));
  const chips  = Array.from(document.querySelectorAll('[data-goto]'));

  let idx = 0;
  let animating = false;
  const ANIM_MS = 520;

  function go(to){
    if (to === idx || to < 0 || to >= pages.length || animating) return;
    const curr = pages[idx];
    const nxt  = pages[to];

    animating = true;

    nxt.classList.add('current');
    nxt.style.zIndex = 2;

    curr.classList.add('animate-out');
    nxt.classList.add('animate-in');

    dots.forEach(d => d.classList.toggle('active', +d.dataset.goto === to));

    window.setTimeout(() => {
      curr.classList.remove('current', 'animate-out');
      curr.style.zIndex = '';
      nxt.classList.remove('animate-in');
      idx = to;
      setBookTitle(idx);
      animating = false;
    }, ANIM_MS);
  }

  if (prev) prev.addEventListener('click', () => go(idx - 1));
  if (next) next.addEventListener('click', () => go(idx + 1));
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.goto)));
  chips.forEach(c => c.addEventListener('click', () => go(+c.dataset.goto)));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(idx - 1);
    if (e.key === 'ArrowRight') go(idx + 1);
  });

  setBookTitle(idx);
}

function setBookTitle(index){
  const titleEl = document.getElementById('bookTitle');
  const pages   = document.querySelectorAll('#book .page');
  if (!titleEl || !pages.length) return;
  titleEl.textContent = pages[index]?.dataset?.title || "";
}

/* HTML escaping */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;"
  }[m]));
}

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", () => {
  loadMenu();
  initFlipbook();
});