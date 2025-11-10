// ============================================================
// feldiserhof-menu-book.js
// Lapozható "könyv" + DINAMIKUS tördelés magasság alapján
// Touch/keyboard/ARIA/resize: FEJLESZTETT VERZIÓ
// ============================================================

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('.menu-portfolio');
    if (!root) return console.warn('[menu-book] ".menu-portfolio" root elem nem található!');

    if (root.dataset.inited === '1') return;
    root.dataset.inited = '1';

    const book = root.querySelector('.book');
    if (!book) return console.warn('[menu-book] ".book" elem nem található!');

    // Dinamikus tördelés (új lapok létrehozása magasság alapján)
    paginateByHeight(book);

    // Flip-book inicializálás
    initMenuBook(root);

    // Dinamikus átresizelés (delay: 0.5s)
    let resizeTimeout = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        paginateByHeight(book);
        initMenuBook(root);
      }, 500);
    });
  });

  // ------------------------------------------------------------
  // 1) DINAMIKUS TÖRDELÉS MAGASSÁG ALAPJÁN
  // ------------------------------------------------------------

  function paginateByHeight(book) {
    const SAFE_MARGIN = 8;
    let sheets = Array.from(book.querySelectorAll('.book-page.page-right'));

    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];

      splitSideByHeight(book, sheet, '.page-front', SAFE_MARGIN, sheets);
      splitSideByHeight(book, sheet, '.page-back', SAFE_MARGIN, sheets);

      sheets = Array.from(book.querySelectorAll('.book-page.page-right'));
    }
    renumberPages(book);
  }

  function splitSideByHeight(book, sheet, sideSelector, SAFE_MARGIN, allSheetsRef) {
    const side = sheet.querySelector(sideSelector);
    if (!side) return;

    const grid = side.querySelector('.menu-items-grid');
    if (!grid) return;

    let items = Array.from(grid.children);
    if (items.length <= 0) return;

    const overflowIndex = findOverflowIndex(side, grid, items, SAFE_MARGIN);
    if (overflowIndex === null) return;

    const overflowItems = items.slice(overflowIndex);
    overflowItems.forEach((el) => grid.removeChild(el));

    let remaining = overflowItems;
    let lastSheet = sheet;
    const titleEl = side.querySelector('.title');
    const { baseTitle, currentIndex } = parseTitle(titleEl ? titleEl.textContent.trim() : '');
    let nextIndex = currentIndex + 1;

    while (remaining.length > 0) {
      const newSheet = cloneEmptySheet(book, lastSheet);
      const newSide = newSheet.querySelector(sideSelector);
      const newGrid = newSide.querySelector('.menu-items-grid');
      const newTitleEl = newSide.querySelector('.title');
      if (newTitleEl) {
        newTitleEl.textContent = nextIndex === 1 ? baseTitle : `${baseTitle} (${nextIndex})`;
      }
      const result = fillSideUntilFull(newSide, newGrid, remaining, SAFE_MARGIN);
      remaining = result.remaining;
      lastSheet.insertAdjacentElement('afterend', newSheet);
      lastSheet = newSheet;
      nextIndex++;
    }
  }

  function findOverflowIndex(side, grid, items, SAFE_MARGIN) {
    const sideRect = side.getBoundingClientRect();
    const maxBottom = sideRect.bottom - SAFE_MARGIN;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (rect.bottom > maxBottom) {
        return i;
      }
    }
    return null;
  }

  function cloneEmptySheet(book, templateSheet) {
    const clone = templateSheet.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('.menu-items-grid').forEach((g) => { g.innerHTML = ''; });
    clone.querySelectorAll('.number-page').forEach((span) => { span.textContent = ''; });
    return clone;
  }

  function fillSideUntilFull(side, grid, items, SAFE_MARGIN) {
    const sideRect = side.getBoundingClientRect();
    const maxBottom = sideRect.bottom - SAFE_MARGIN;
    const fitted = [];
    const remaining = [];
    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      grid.appendChild(el);
      const rect = el.getBoundingClientRect();
      if (rect.bottom > maxBottom) {
        grid.removeChild(el);
        remaining.push(el, ...items.slice(i + 1));
        break;
      } else {
        fitted.push(el);
      }
    }
    if (fitted.length === items.length) return { fitted, remaining: [] };
    return { fitted, remaining };
  }

  function parseTitle(text) {
    const m = text.match(/^(.*?)(?:\s*\((\d+)\))?$/);
    if (!m) return { baseTitle: text, currentIndex: 1 };
    const base = m[1].trim();
    const idx = m[2] ? parseInt(m[2], 10) : 1;
    return { baseTitle: base, currentIndex: isNaN(idx) ? 1 : idx };
  }

  function renumberPages(book) {
    const pages = Array.from(book.querySelectorAll('.book-page.page-right'));
    let num = 1;
    pages.forEach((sheet) => {
      const frontNum = sheet.querySelector('.page-front .number-page');
      const backNum = sheet.querySelector('.page-back .number-page');
      if (frontNum) {
        frontNum.textContent = num++;
        frontNum.setAttribute('aria-label', `Oldalszám: ${frontNum.textContent}`);
      }
      if (backNum) {
        backNum.textContent = num++;
        backNum.setAttribute('aria-label', `Oldalszám: ${backNum.textContent}`);
      }
    });
  }

  // ------------------------------------------------------------
  // 2) A meglévő flip-book init (kibővített)
  // ------------------------------------------------------------

  function initMenuBook(root) {
    const book = root.querySelector('.book');
    const sheets = Array.from(root.querySelectorAll('.book .page-right'));
    const dotsWrap = root.querySelector('.book-dots');
    if (!book || sheets.length === 0) return;

    let pageIndex = 0;
    let isAnimating = false;
    const ANIM_MS = 600;

    sheets.forEach((el, i) => el.classList.toggle('turn', i > 0));

    // pöttyök + ARIA navigáció
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      dots = sheets.map((_, i) => {
        const d = document.createElement('span');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        d.setAttribute('role', 'button');
        d.setAttribute('tabindex', '0');
        d.setAttribute('aria-label', `Ugrás a ${i + 1}. oldalra`);
        d.addEventListener('click', () => goTo(i));
        d.addEventListener('keydown', (evt) => { if (evt.key === 'Enter' || evt.key === ' ') goTo(i); });
        dotsWrap.appendChild(d);
        return d;
      });
      dotsWrap.setAttribute('role', 'navigation');
      dotsWrap.setAttribute('aria-label', 'Oldal navigáció');
    }

    book.setAttribute('role', 'region');
    book.setAttribute('aria-label', 'Lapozható menükönyv');

    const clampIndex = (i) => Math.max(0, Math.min(sheets.length - 1, i));

    function baseZ(i, turned) {
      return turned ? i + 1 : sheets.length * 2 - i;
    }

    function refreshUI() {
      sheets.forEach((el, i) => {
        const turned = i < pageIndex;
        el.classList.toggle('turn', turned);
        if (el.dataset.boost === '1') return;
        el.style.zIndex = String(baseZ(i, turned));
      });
      dots.forEach((d, i) => d.classList.toggle('active', i === pageIndex));
    }

    function boostForAnimation(idx) {
      const el = sheets[idx];
      if (!el) return;
      el.dataset.boost = '1';
      el.style.zIndex = String(sheets.length * 5);
      setTimeout(() => {
        delete el.dataset.boost;
        const turned = idx < pageIndex;
        el.style.zIndex = String(baseZ(idx, turned));
      }, ANIM_MS);
    }

    function updateBookView(oldIndex, newIndex) {
      if (isAnimating) return;
      isAnimating = true;
      const movingIdx = newIndex > oldIndex ? oldIndex : newIndex;
      boostForAnimation(movingIdx);
      refreshUI();
      setTimeout(() => { isAnimating = false; }, ANIM_MS);
    }

    function next() {
      if (pageIndex >= sheets.length - 1 || isAnimating) return;
      const old = pageIndex;
      pageIndex = clampIndex(pageIndex + 1);
      updateBookView(old, pageIndex);
    }

    function prev() {
      if (pageIndex <= 0 || isAnimating) return;
      const old = pageIndex;
      pageIndex = clampIndex(pageIndex - 1);
      updateBookView(old, pageIndex);
    }

    function goTo(i) {
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

    // Gombok (arrow, touch)
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.nextprev-btn');
      if (!btn || !root.contains(btn)) return;
      const role = btn.getAttribute('data-role');
      if (role === 'next') next();
      if (role === 'prev') prev();
    });

    // ---- Keyboard: NEM aktív input-ban csak! ----
    document.addEventListener('keydown', (e) => {
      if (isAnimating) return;
      // Ha épp input/textarea/fókuszált, nem lapozunk
      const act = document.activeElement;
      if (act && (act.tagName === "INPUT" || act.tagName === "TEXTAREA" || act.isContentEditable)) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    // ----- Touch SWIPE támogatás -----
    let touchX = 0;
    let touchY = 0;
    let moved = false;
    book.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
        moved = false;
      }
    }, {passive:true});
    book.addEventListener('touchmove', (e) => {
      moved = true;
    }, {passive:true});
    book.addEventListener('touchend', (e) => {
      if (!moved || e.changedTouches.length !== 1) return;
      const deltaX = e.changedTouches[0].clientX - touchX;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchY);
      if (deltaY > 50) return; // nem oldalirány
      if (Math.abs(deltaX) > 60) {
        if (deltaX < 0) next();
        else prev();
      }
    });

    refreshUI();
  }
})();
