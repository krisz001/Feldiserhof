// ============================================================
// feldiserhof-menu-book.js
// Lapozható "könyv" + DINAMIKUS tördelés magasság alapján
// ============================================================

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('.menu-portfolio');
    if (!root) return;

    // ne inicializáljuk kétszer
    if (root.dataset.inited === '1') return;
    root.dataset.inited = '1';

    const book = root.querySelector('.book');
    if (!book) return;

    // van-e egyáltalán menü elem?
    const firstGrid = book.querySelector('.menu-items-grid');
    const hasItems = firstGrid && firstGrid.children.length > 0;

    if (!hasItems) {
      // Nagyon fontos jelzés: itt derül ki, ha a JSON / EJS nem töltött be semmit.
      console.warn(
        '[feldiserhof-menu-book] Nincs egyetlen menü tétel sem (.menu-items-grid > *). ' +
        'A könyv logika működik, de nem lesz mit tördelni. Ellenőrizd a menü-adatok betöltését!'
      );
      // Ilyenkor legalább a lapozás működjön az üres oldalakra is
      initMenuBook(root);
      return;
    }

    // Először: dinamikus tördelés (új lapok létrehozása, ha nem fér ki)
    paginateByHeight(book);

    // Utána: flip-book inicializálás
    initMenuBook(root);
  });

  // ------------------------------------------------------------
  // 1) DINAMIKUS TÖRDELÉS MAGASSÁG ALAPJÁN
  // ------------------------------------------------------------

  function paginateByHeight(book) {
    const SAFE_MARGIN = 8; // pár px mozgástér

    // A lapok jobb oldali "sheet"-jei.
    let sheets = Array.from(book.querySelectorAll('.book-page.page-right'));

    // Végigmegyünk az eredeti sheeteken.
    // Mivel közben újakat fogunk beszúrni, index alapján iterálunk.
    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];

      // FRONT + BACK külön kezelve
      splitSideByHeight(book, sheet, '.page-front', SAFE_MARGIN);
      splitSideByHeight(book, sheet, '.page-back', SAFE_MARGIN);

      // frissítjük a sheets listát, mert beszúrhattunk új lapokat is
      sheets = Array.from(book.querySelectorAll('.book-page.page-right'));
    }

    // Lapszámok újraszámolása (1,2,3,... minden oldalra)
    renumberPages(book);
  }

  function splitSideByHeight(book, sheet, sideSelector, SAFE_MARGIN) {
    const side = sheet.querySelector(sideSelector);
    if (!side) return;

    const grid = side.querySelector('.menu-items-grid');
    if (!grid) return;

    let items = Array.from(grid.children);
    if (items.length <= 0) return;

    // Megnézzük, hol kezd túlcsúszni az utolsó elem
    const overflowIndex = findOverflowIndex(side, items, SAFE_MARGIN);
    if (overflowIndex === null) return; // Minden kifért, nincs dolgunk

    // Az overflow elemeket levesszük erről az oldalról
    const overflowItems = items.slice(overflowIndex);
    overflowItems.forEach((el) => grid.removeChild(el));

    // További új lap(ok): ugyanennek az oldalnak a folytatása
    // (ua. kategória, de "(2)", "(3)" stb.)
    let remaining = overflowItems;
    let lastSheet = sheet;

    // Alap cím + már meglévő sorszám kinyerése
    const titleEl = side.querySelector('.title');
    const { baseTitle, currentIndex } = parseTitle(
      titleEl ? titleEl.textContent.trim() : ''
    );
    let nextIndex = currentIndex + 1;

    while (remaining.length > 0) {
      const newSheet = cloneEmptySheet(book, lastSheet);

      const newSide = newSheet.querySelector(sideSelector);
      const newGrid = newSide.querySelector('.menu-items-grid');

      // Új lap címe: "Mittags Speisekarte (2)" stb.
      const newTitleEl = newSide.querySelector('.title');
      if (newTitleEl) {
        newTitleEl.textContent =
          nextIndex === 1 ? baseTitle : `${baseTitle} (${nextIndex})`;
      }

      // Feltöltjük az új oldalt annyi elemmel, amennyi belefér
      const result = fillSideUntilFull(newSide, newGrid, remaining, SAFE_MARGIN);
      remaining = result.remaining;

      // berakjuk a lapot a DOM-ba az aktuális után
      lastSheet.insertAdjacentElement('afterend', newSheet);
      lastSheet = newSheet;
      nextIndex++;
    }
  }

  // Megkeresi, hányadik elemnél csúsznak ki a tételek a lap aljáról
  function findOverflowIndex(side, items, SAFE_MARGIN) {
    const sideRect = side.getBoundingClientRect();
    const maxBottom = sideRect.bottom - SAFE_MARGIN;

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (rect.bottom > maxBottom) {
        return i;
      }
    }
    return null; // nincs overflow
  }

  // Létrehoz egy új, üres "sheet"-et (front/back struktúrával),
  // a mintának az adott sheetet használva.
  function cloneEmptySheet(book, templateSheet) {
    const clone = templateSheet.cloneNode(true);

    // Ne legyen duplikált ID
    clone.removeAttribute('id');

    // Minden gridet kiürítünk
    clone.querySelectorAll('.menu-items-grid').forEach((g) => {
      g.innerHTML = '';
    });

    // Oldalszám tartalma majd JS-ből lesz írva
    clone.querySelectorAll('.number-page').forEach((span) => {
      span.textContent = '';
    });

    return clone;
  }

  // Feltölti az adott oldalt a megadott tételekből, amíg kiférnek
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
        // ez már nem fér ki -> visszavesszük
        grid.removeChild(el);
        remaining.push(el, ...items.slice(i + 1));
        break;
      } else {
        fitted.push(el);
      }
    }

    // ha mind kifért:
    if (fitted.length === items.length) {
      return { fitted, remaining: [] };
    }

    return { fitted, remaining };
  }

  // Címek: "Mittags Speisekarte (2)" -> { baseTitle: 'Mittags Speisekarte', currentIndex: 2 }
  // vagy ha nincs zárójel: "Mittags Speisekarte" -> { baseTitle: 'Mittags Speisekarte', currentIndex: 1 }
  function parseTitle(text) {
    const m = text.match(/^(.*?)(?:\s*\((\d+)\))?$/);
    if (!m) return { baseTitle: text, currentIndex: 1 };
    const base = m[1].trim();
    const idx = m[2] ? parseInt(m[2], 10) : 1;
    return { baseTitle: base, currentIndex: isNaN(idx) ? 1 : idx };
  }

  // Minden oldalhoz folyamatos lapszám (1,2,3,...)
  function renumberPages(book) {
    const pages = Array.from(book.querySelectorAll('.book-page.page-right'));
    let num = 1;

    pages.forEach((sheet) => {
      const frontNum = sheet.querySelector('.page-front .number-page');
      const backNum = sheet.querySelector('.page-back .number-page');

      if (frontNum) {
        frontNum.textContent = num++;
      }
      if (backNum) {
        backNum.textContent = num++;
      }
    });
  }

  // ------------------------------------------------------------
  // 2) Flip-book init
  // ------------------------------------------------------------

  function initMenuBook(root) {
    const book = root.querySelector('.book');
    const sheets = Array.from(root.querySelectorAll('.book .page-right'));
    const dotsWrap = root.querySelector('.book-dots');

    if (!book || sheets.length === 0) return;

    let pageIndex = 0;
    let isAnimating = false;
    const ANIM_MS = 600;

    // Kezdő állapot: az első nincs "turn"-ölve, a többi igen
    sheets.forEach((el, i) => el.classList.toggle('turn', i > 0));

    // pöttyök
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

      dots.forEach((d, i) => {
        d.classList.toggle('active', i === pageIndex);
      });
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

      setTimeout(() => {
        isAnimating = false;
      }, ANIM_MS);
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

    // belső nyilak
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.nextprev-btn');
      if (!btn || !root.contains(btn)) return;
      const role = btn.getAttribute('data-role');
      if (role === 'next') next();
      if (role === 'prev') prev();
    });

    // billentyűk
    document.addEventListener('keydown', (e) => {
      if (isAnimating) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    refreshUI();
  }
})();
