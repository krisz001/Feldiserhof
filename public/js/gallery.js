// public/js/gallery.js
(() => {
  const root = document.getElementById("galleryGrid") || document.getElementById("galleryView");
  if (!root) return;

  // ---- Lightbox (ha van Bootstrap modal) ----
  const modalEl = document.getElementById("lightbox");
  const imgEl   = document.getElementById("lightboxImg");
  const capEl   = document.getElementById("lightboxCap");
  const modal   = modalEl && window.bootstrap?.Modal ? new bootstrap.Modal(modalEl) : null;

  // ---- Állapot ----
  let ALBUMS = {};       // { hotel: [ {src,alt}, ... ], ... }
  let currentAlbum = ""; // "" = album-lista

  const titleMap = {
    hotel: "🏨 Hotel",
    restaurant: "🍽️ Restaurant",
    feldis: "🌄 Feldis"
  };

  // ================= helpers =================
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };

  const getAlbumFromHash = () => {
    const m = location.hash.match(/#(?:album=|gallery=)([^&]+)/i);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const setAlbumHash = (name) => {
    const newHash = name ? `#album=${encodeURIComponent(name)}` : "";
    if (newHash !== location.hash) history.pushState({}, "", newHash || location.pathname + location.search);
  };

  // Üveges, pill vissza-gomb (ikon + sticky)
  function backBar(label){
    const wrap = document.createElement("div");
    wrap.className = "gallery-subnav";
    wrap.innerHTML = `
      <a href="#gallery" id="backToAlbums" class="btn-back" aria-label="Zurück zur Galerie">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Zurück zur Galerie</span>
      </a>
      <h3 class="m-0 fw-bold">${label}</h3>
    `;
    // gomb logika
    const goBack = (e) => {
      if (e) e.preventDefault();
      setAlbumHash("");               // hash törlés
      renderAlbums();                 // album lista
    };
    wrap.querySelector("#backToAlbums").addEventListener("click", goBack, { passive:true });

    // Esc = vissza
    const onKey = (e) => { if (e.key === "Escape") goBack(); };
    window.addEventListener("keydown", onKey, { passive:true, once:true });

    return wrap;
  }
function folderCard(name, items){
  const card = document.createElement("button");
  card.type = "button";
  card.className = "folder-card text-start";
  const cover = (items && items[0]?.src) || "/img/placeholder.png";
  const label = titleMap[name] || name;

  card.innerHTML = `
    <div class="folder-cover">
      <img alt="${label}" loading="lazy" decoding="async" style="opacity:0">
      <div class="skel"></div>
    </div>
    <div class="folder-meta">
      <div class="folder-name">${label}</div>
      <div class="folder-count">${items?.length || 0} Fotos</div>
    </div>
  `;

  // kép betöltés + skeleton eltüntetés
  const img = card.querySelector("img");
  const skel = card.querySelector(".skel");
  img.addEventListener("load", () => {
    skel?.remove();
    img.style.opacity = "1";
  });
  img.addEventListener("error", () => {
    // hiba esetén is tüntessük el, hogy ne villogjon
    skel?.remove();
    img.style.opacity = "1";
  });
  img.src = cover;

  card.addEventListener("click", () => renderPhotos(name), { passive:true });
  return card;
}

function photoCard(item){
  const a = document.createElement("a");
  a.href = item.src;
  a.className = "gallery-card";
  a.innerHTML = `
    <img alt="${item.alt || ''}" loading="lazy" decoding="async" style="opacity:0">
    <div class="skel"></div>
  `;

  const img = a.querySelector("img");
  const skel = a.querySelector(".skel");
  img.addEventListener("load", () => { skel?.remove(); img.style.opacity = "1"; });
  img.addEventListener("error", () => { skel?.remove(); img.style.opacity = "1"; });
  img.src = item.src;

  a.addEventListener("click", (e) => {
    if (!modal) return;
    e.preventDefault();
    if (imgEl) { imgEl.src = item.src; imgEl.alt = item.alt || ""; }
    if (capEl) capEl.textContent = item.alt || "";
    modal.show();
  });

  return a;
}


  // ================= renderers =================
  function renderAlbums(){
    currentAlbum = "";
    clear(root);

    const names = Object.keys(ALBUMS);
    if (!names.length){
      root.innerHTML = `<p class="text-muted">Noch keine Bilder.</p>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "folder-grid";
    names.forEach(name => grid.appendChild(folderCard(name, ALBUMS[name])));
    root.appendChild(grid);
  }

  function renderPhotos(albumName){
    currentAlbum = albumName;
    clear(root);

    root.appendChild(backBar(titleMap[albumName] || albumName));

    const items = ALBUMS[albumName] || [];
    if (!items.length){
      const p = document.createElement("p");
      p.className = "text-muted";
      p.textContent = "In diesem Album gibt es noch keine Bilder.";
      root.appendChild(p);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "gallery-grid";
    items.forEach(it => grid.appendChild(photoCard(it)));
    root.appendChild(grid);
  }

  // ================= init + routing =================
  async function init(){
    try{
      const r = await fetch("/api/gallery", { headers:{ "Accept":"application/json" } });
      if(!r.ok) throw new Error("API " + r.status);
      const data = await r.json();
      ALBUMS = data.albums || {};

      // Hash alapján nyitunk albumot, ha van (#album=hotel)
      const initial = getAlbumFromHash();
      if (initial && ALBUMS[initial]) {
        renderPhotos(initial);
      } else {
        renderAlbums();
      }
    }catch(err){
      console.error("Galerie API Fehler:", err);
      root.innerHTML = `<p class="text-muted">Galerie konnte nicht geladen werden.</p>`;
    }
  }

  // Hash változás figyelése (vissza/előre gomb)
  window.addEventListener("hashchange", () => {
    const name = getAlbumFromHash();
    if (!name) return renderAlbums();
    if (ALBUMS[name]) renderPhotos(name);
  }, { passive:true });

  init();
})();
