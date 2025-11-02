// ============================================================
// feldiserhof-menu-book.js
// Profi, idempotens könyv-lapozó – csak az EJS-ben generált oldalakat kezeli.
// KIEGÉSZÍTVE: adminból tiltható "menuBookEnabled" guarddal
// ============================================================

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', initMenuBook);

  function initMenuBook() {
    const root = document.querySelector('.menu-portfolio');
    if (!root) return;

    // ---- Idempotens guard
    if (root.dataset.inited === '1') return;
    root.dataset.inited = '1';

    // ---- Feature flag / lock wrapper felderítése (ÚJ)
    const guard = root.querySelector('#menuBookGuard') || root.querySelector('.book-guard');
    // forrás sorrend: DOM data-enabled → window.FEATURES → fallback true
    const enabled =
      (guard && String(guard.dataset.enabled) === 'true') ||
      (!!(window.FEATURES && window.FEATURES.menuBookEnabled)) ||
      false; // ha nincs info, inkább legyen zárt (biztonságosabb)

    // ---- Lokális referenciák
    const book     = root.querySelector('.book');
    const sheets   = Array.from(root.querySelectorAll('.book .page-right[data-sheet="1"]'));
    const btnPrev  = root.querySelector('.book-btn.prev'); // opcionális
    const btnNext  = root.querySelector('.book-btn.next'); // opcionális
    const dotsWrap = root.querySelector('.book-dots');

    if (!book || sheets.length === 0) return;

    // ---- Ha tiltva: vizuális lock állapot biztosítása (ÚJ)
    if (!enabled) {
      guard?.classList.add('book--locked');
      book.classList.add('book--locked');
    } else {
      guard?.classList.remove('book--locked');
      book.classList.remove('book--locked');
    }

    // ---- Állapot
    let pageIndex   = 0;          // melyik sheet a „választóvonal”
    let isAnimating = false;
    const ANIM_MS   = 600;        // igazítsd a CSS transitionhöz

    // Indulás: csak az első legyen „jobbra”, a többin turn class
    sheets.forEach((el, i) => el.classList.toggle('turn', i > 0));

    // ---- Pöttyök
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      dots = sheets.map((_, i) => {
        const d = document.createElement('span');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        d.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(d);
        return d;
      });
    }

    // ---- Helper-ek
    const clampIndex  = (i) => Math.max(0, Math.min(sheets.length - 1, i));
    const setDisabled = (el, disabled) => { if (el) el.disabled = !!disabled; };
    const isLocked    = () => !enabled; // egyszerűsített guard (ÚJ)

    // Alap rétegsorrend
    function baseZ(i, turned) {
      return turned ? (i + 1) : (sheets.length * 2 - i);
    }

    function refreshUI() {
      sheets.forEach((el, i) => {
        const turned = i < pageIndex;
        el.classList.toggle('turn', turned);

        if (el.dataset.boost === '1') return;
        el.style.zIndex = String(baseZ(i, turned));
      });

      // Külső prev/next
      setDisabled(btnPrev, isLocked() || pageIndex === 0);
      setDisabled(btnNext, isLocked() || pageIndex === sheets.length - 1);

      // Pöttyök
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === pageIndex);
        if (isLocked()) d.classList.add('disabled'); else d.classList.remove('disabled');
      });

      // Belső nyilak tiltása a széleken + lock eset
      root.querySelectorAll('.nextprev-btn').forEach(b => {
        b.classList.remove('is-disabled');
        if (isLocked()) b.classList.add('is-disabled');
      });

      if (!isLocked()) {
        const current   = sheets[pageIndex];
        const frontNext = current?.querySelector('.page-front .nextprev-btn[data-role="next"]');
        const backPrev  = current?.querySelector('.page-back  .nextprev-btn[data-role="prev"]');
        if (pageIndex === sheets.length - 1 && frontNext) frontNext.classList.add('is-disabled');
        if (pageIndex === 0 && backPrev)                  backPrev.classList.add('is-disabled');
      }
    }

    // Az épp forduló lapot ideiglenesen legfelülre tesszük
    function boostForAnimation(idx) {
      const el = sheets[idx];
      if (!el) return;
      el.dataset.boost = '1';
      el.style.zIndex = String(sheets.length * 5); // biztosan a legtetején
      setTimeout(() => {
        delete el.dataset.boost;
        const turned = idx < pageIndex;
        el.style.zIndex = String(baseZ(idx, turned));
      }, ANIM_MS);
    }

    function updateBookView(oldIndex, newIndex) {
      if (isAnimating || isLocked()) return; // (ÚJ) lock esetén nincs anim
      isAnimating = true;

      const movingIdx = newIndex > oldIndex ? oldIndex : newIndex;
      boostForAnimation(movingIdx);

      refreshUI();

      setTimeout(() => { isAnimating = false; }, ANIM_MS);
    }

    function next() {
      if (isLocked()) return lockedNudge();
      if (pageIndex >= sheets.length - 1 || isAnimating) return;
      const old = pageIndex;
      pageIndex = clampIndex(pageIndex + 1);
      updateBookView(old, pageIndex);
    }

    function prev() {
      if (isLocked()) return lockedNudge();
      if (pageIndex <= 0 || isAnimating) return;
      const old = pageIndex;
      pageIndex = clampIndex(pageIndex - 1);
      updateBookView(old, pageIndex);
    }

    function goTo(i) {
      if (isLocked()) return lockedNudge();
      if (isAnimating) return;
      const target = clampIndex(i);
      if (target === pageIndex) return;

      const step = target > pageIndex ? 1 : -1;
      const run = () => {
        if (pageIndex === target) return;
        const old = pageIndex;
        pageIndex = clampIndex(pageIndex + step);
        updateBookView(old, pageIndex);
        setTimeout(run, ANIM_MS);
      };
      run();
    }

    // Finom visszajelzés, ha zárt (ÚJ)
    function lockedNudge() {
      guard?.classList.add('shake');
      book.classList.add('shake');
      setTimeout(() => { guard?.classList.remove('shake'); book.classList.remove('shake'); }, 400);
    }

    // ---- Delegált kattintás a belső nyilakra
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.nextprev-btn');
      if (!btn || !root.contains(btn)) return;
      if (btn.classList.contains('is-disabled') || isLocked()) return lockedNudge();
      const role = btn.getAttribute('data-role');
      if (role === 'next') next();
      if (role === 'prev') prev();
    });

    // ---- Külső prev/next
    if (btnPrev) btnPrev.addEventListener('click', (e) => { if (isLocked()) return lockedNudge(); prev(); });
    if (btnNext) btnNext.addEventListener('click', (e) => { if (isLocked()) return lockedNudge(); next(); });

    // ---- Billentyűk
    document.addEventListener('keydown', (e) => {
      if (isAnimating || isLocked()) return;
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Home' && pageIndex !== 0) { const old = pageIndex; pageIndex = 0; updateBookView(old, pageIndex); }
      if (e.key === 'End'  && pageIndex !== sheets.length - 1) { const old = pageIndex; pageIndex = sheets.length - 1; updateBookView(old, pageIndex); }
    });

    // ---- Touch-swipe
    let sx = 0, sy = 0;
    root.addEventListener('touchstart', (e) => {
      if (isLocked()) return; // tiltva
      if (!e.changedTouches || !e.changedTouches[0]) return;
      sx = e.changedTouches[0].screenX;
      sy = e.changedTouches[0].screenY;
    }, { passive: true });

    root.addEventListener('touchend', (e) => {
      if (isAnimating || isLocked() || !e.changedTouches || !e.changedTouches[0]) return;
      const ex = e.changedTouches[0].screenX;
      const ey = e.changedTouches[0].screenY;
      const dx = ex - sx, dy = ey - sy;
      if (Math.abs(dy) < 30) {
        if (dx < -50) next();
        if (dx >  50) prev();
      }
    }, { passive: true });

    // ---- Magasság igazítás (desktop)
    function adjustBookHeight() {
      if (!book) return;
      if (window.innerWidth > 768) {
        const vh    = window.innerHeight;
        const nav   = document.querySelector('nav');
        const foot  = document.querySelector('footer');
        const navH  = nav  ? nav.offsetHeight  : 0;
        const footH = foot ? foot.offsetHeight : 0;
        const h     = Math.max(vh - navH - footH - 100, 500);
        book.style.minHeight = h + 'px';
      } else {
        book.style.minHeight = '';
      }
    }
    window.addEventListener('load',   adjustBookHeight, { once: true });
    window.addEventListener('resize', adjustBookHeight);

    // ---- Első render
    refreshUI();
    adjustBookHeight();

    console.log('Feldiserhof Menü – valódi lapok száma:', sheets.length, '| enabled:', enabled);
  }
})();

// ============================================================
// public/js/menu.js (részlet) – KIEGÉSZÍTVE: több szelektor + guard támogatás
// ============================================================
(function(){
  const features = window.FEATURES || {};
  // előnyben részesítjük a DOM-on átadott állapotot (menuBookGuard data-enabled)
  const guard  = document.querySelector('#menuBookGuard') || document.querySelector('.book-guard');
  const bookEl = document.getElementById('menuBook') || guard || document.querySelector('.book');
  const enabled = (guard && String(guard.dataset.enabled) === 'true') || !!features.menuBookEnabled;

  // vizuális állapot (ha SSR-ből nem jött már)
  if (!enabled) bookEl?.classList.add('book--locked'); else bookEl?.classList.remove('book--locked');

  // Példa: a nyitást végző gomb/gesture:
  const openBtn = document.querySelector('[data-action="open-book"]');

  function openBook() {
    if (!enabled) {
      // finom jelzés
      bookEl?.classList.add('shake');
      setTimeout(()=>bookEl?.classList.remove('shake'), 400);
      return; // tiltva
    }
    // --- IDE jön az eddigi nyitó animációd hívása ---
    // openFlipAnimation();
  }

  openBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openBook();
  });

  // Ha gesztusra nyitod (pl. swipe), ott is ugyanígy: ha !enabled => return
})();
