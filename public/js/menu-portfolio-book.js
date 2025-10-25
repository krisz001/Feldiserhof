document.addEventListener('DOMContentLoaded', function () {
  const root = document.querySelector('.menu-portfolio');
  if (!root) return;

  // --- Alap elemek ---
  const sheets = Array.from(document.querySelectorAll('.book .page-right')); // oldalpárok
  const bookTitle = document.getElementById('bookTitle');
  const btnPrev = document.querySelector('.book-btn.prev');
  const btnNext = document.querySelector('.book-btn.next');
  const dotsWrap = document.querySelector('.book-dots');

  // Nincs mit lapozni
  if (sheets.length === 0) return;

  // --- Állapot ---
  let pageIndex = 0;          // aktuális sheet index
  let isAnimating = false;

  // indulás: csak az első látszódjon
  sheets.forEach((el, i) => el.classList.toggle('turn', i > 0));

  // --- Pöttyök legenerálása ---
  dotsWrap.innerHTML = '';
  const dots = sheets.map((_, i) => {
    const d = document.createElement('span');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(d);
    return d;
  });

  // --- Segédek ---
  function clampIndex(i) {
    return Math.max(0, Math.min(sheets.length - 1, i));
  }

  function setDisabled(el, disabled) {
    if (!el) return;
    el.disabled = !!disabled;
  }

  function refreshUI() {
    // lapok rétegzése + állapota
    sheets.forEach((el, i) => {
      el.classList.toggle('turn', i < pageIndex);            // az eddigiek átlapozva
      el.style.zIndex = (sheets.length - i).toString();       // helyes stacking
    });

    // alsó gombok (nem körkörös)
    setDisabled(btnPrev, pageIndex === 0);
    setDisabled(btnNext, pageIndex === sheets.length - 1);

    // pöttyök
    dots.forEach((d, i) => d.classList.toggle('active', i === pageIndex));

    // saroknyilak inaktiválása CSAK az aktuális lapon
    // (fronton a NEXT, backen a PREV)
    // először mindent engedélyezünk
    root.querySelectorAll('.nextprev-btn').forEach(b => b.classList.remove('is-disabled'));

    const current = sheets[pageIndex];
    const frontNext = current.querySelector('.page-front .nextprev-btn[data-role="next"]');
    const backPrev  = current.querySelector('.page-back  .nextprev-btn[data-role="prev"]');

    if (pageIndex === sheets.length - 1 && frontNext) {
      frontNext.classList.add('is-disabled');
    }
    if (pageIndex === 0 && backPrev) {
      backPrev.classList.add('is-disabled');
    }

    // (opcionális) cím frissítése
    if (bookTitle) {
      const titles = [
        'Speisekarte - Willkommen',
        'Vorspeisen & Salate',
        'Hauptgerichte',
        'Desserts & Getränke'
      ];
      bookTitle.textContent = titles[pageIndex] || 'Speisekarte';
    }
  }

  function updateBookView() {
    if (isAnimating) return;
    isAnimating = true;

    // animáció érzete: a DOM osztályok már fent, csak várunk a CSS transitionre
    refreshUI();

    setTimeout(() => {
      isAnimating = false;
    }, 600); // illeszkedik a CSS transition idejéhez
  }

  function next() {
    if (pageIndex >= sheets.length - 1 || isAnimating) return; // NEM körkörös
    pageIndex = clampIndex(pageIndex + 1);
    updateBookView();
  }

  function prev() {
    if (pageIndex <= 0 || isAnimating) return; // NEM körkörös
    pageIndex = clampIndex(pageIndex - 1);
    updateBookView();
  }

  function goTo(i) {
    if (isAnimating) return;
    const target = clampIndex(i);
    if (target === pageIndex) return;
    pageIndex = target;
    updateBookView();
  }

  // --- Események ---
  // Saroknyilak – delegálva, mert több lapon is vannak
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.nextprev-btn');
    if (!btn) return;
    if (btn.classList.contains('is-disabled')) return;
    const role = btn.getAttribute('data-role');
    if (role === 'next') next();
    if (role === 'prev') prev();
  });

  // Alsó gombok
  if (btnPrev) btnPrev.addEventListener('click', prev);
  if (btnNext) btnNext.addEventListener('click', next);

  // Billentyűk
  document.addEventListener('keydown', (e) => {
    if (isAnimating) return;
    if (e.key === 'ArrowLeft')  prev();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'Home') { if (pageIndex !== 0) { pageIndex = 0; updateBookView(); } }
    if (e.key === 'End')  { if (pageIndex !== sheets.length - 1) { pageIndex = sheets.length - 1; updateBookView(); } }
  });

  // Swipe mobilon
  let sx = 0, sy = 0;
  root.addEventListener('touchstart', (e) => {
    sx = e.changedTouches[0].screenX;
    sy = e.changedTouches[0].screenY;
  }, { passive: true });

  root.addEventListener('touchend', (e) => {
    if (isAnimating) return;
    const ex = e.changedTouches[0].screenX;
    const ey = e.changedTouches[0].screenY;
    const dx = ex - sx, dy = ey - sy;
    if (Math.abs(dy) < 30) {
      if (dx < -50) next();
      if (dx >  50) prev();
    }
  }, { passive: true });

  // Reszponzív magasság (meghagyva)
  function adjustBookHeight() {
    const book = document.querySelector('.menu-portfolio .book');
    if (!book) return;
    if (window.innerWidth > 768) {
      const vh = window.innerHeight;
      const nav = document.querySelector('nav') ? document.querySelector('nav').offsetHeight : 0;
      const footer = document.querySelector('footer') ? document.querySelector('footer').offsetHeight : 0;
      const h = Math.max(vh - nav - footer - 100, 500);
      book.style.minHeight = h + 'px';
    } else {
      book.style.minHeight = ''; // mobilon hagyjuk a CSS-t érvényesülni
    }
  }
  window.addEventListener('load', adjustBookHeight);
  window.addEventListener('resize', adjustBookHeight);

  // Első megjelenítés
  refreshUI();
  console.log('Feldiserhof Menü – lapok:', sheets.length);
});
