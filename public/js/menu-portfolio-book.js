// ============================================================
// feldiserhof-menu-book.js
// Menü JSON -> dinamikus, magasság alapú lapozás + fejlett flipbook
// Desktop: dupla oldal (front+back), mobil: 1 oldal / lap
// ============================================================

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('.menu-portfolio');
    if (!root) {
      console.warn('[menu-book] ".menu-portfolio" root elem nem található!');
      return;
    }

    // ne fusson kétszer
    if (root.dataset.inited === '1') return;
    root.dataset.inited = '1';

    const book = root.querySelector('.book');
    if (!book) {
      console.warn('[menu-book] ".book" elem nem található!');
      return;
    }

    const menu = getMenuDataFromDom();
    if (menu && Array.isArray(menu.categories) && menu.categories.length) {
      buildDynamicPagesByHeight(root, menu); // JSON -> oldalak magasság alapján
    } else {
      console.warn(
        '[menu-book] Nincs érvényes menuData (categories). ' +
          'Ellenőrizd a #menuDataScript JSON-t vagy a window.menuData változót.'
      );
    }

    // flipbook init (akkor is, ha csak statikus markup maradt)
    initMenuBook(root);
  });

  // ------------------------------------------------------------
  // Menü JSON kiolvasása (#menuDataScript vagy window.menuData)
  // ------------------------------------------------------------
  function getMenuDataFromDom() {
    const script = document.getElementById('menuDataScript');
    if (script && script.textContent.trim()) {
      try {
        return JSON.parse(script.textContent);
      } catch (e) {
        console.error('[menu-book] Menu JSON parse hiba:', e);
      }
    }
    if (window.menuData) return window.menuData;
    return null;
  }

  // ============================================================
  // 1) Dinamikus oldalgenerálás – MAGASSÁG ALAPJÁN, JSON-ból
  // ============================================================
  function buildDynamicPagesByHeight(root, menu) {
    const book = root.querySelector('.book');
    if (!book) return;

    const SAFE_MARGIN = 8; // pár px mozgástér az oldal alján
    const isMobile = window.innerWidth <= 768;

    // Sablon jobboldali laphoz – EJS markupból KÖTELEZŐEN legyen egy
    const templateOriginal = book.querySelector('.book-page.page-right');
    if (!templateOriginal) {
      console.error(
        '[menu-book] Nem található .book-page.page-right sablon. ' +
          'Legalább egy lapot ki kell renderelni EJS-ben.'
      );
      return;
    }

    // Klónozható, megtisztított sablon
    const template = templateOriginal.cloneNode(true);
    template.querySelectorAll('.menu-items-grid').forEach((el) => (el.innerHTML = ''));
    template.querySelectorAll('.title').forEach((el) => (el.textContent = ''));
    template.querySelectorAll('.number-page').forEach((el) => (el.textContent = ''));

    // az eredeti EJS-lapokat töröljük
    book.querySelectorAll('.book-page.page-right').forEach((p) => p.remove());

    const pages = [];
    let globalPageNo = 1;

    const categories = Array.isArray(menu.categories) ? menu.categories : [];

    categories.forEach((cat, catIndex) => {
      const items = Array.isArray(cat.items) ? cat.items : [];
      if (!items.length) return;

      const baseName = cat.name || `Kategorie ${catIndex + 1}`;
      let pageNoInCat = 1;
      let idx = 0;

      while (idx < items.length) {
        const pageEl = template.cloneNode(true);
        book.appendChild(pageEl); // DOM-ban kell lennie a méréshez

        const frontEl = pageEl.querySelector('.page-front');
        const backEl = pageEl.querySelector('.page-back');

        // FRONT – mindig használjuk
        const frontResult = fillSideByHeight(
          frontEl,
          items,
          idx,
          baseName,
          pageNoInCat,
          globalPageNo,
          SAFE_MARGIN
        );
        const usedFront = frontResult.used;
        idx = frontResult.nextIndex;

        let usedBack = false;

        if (!isMobile && idx < items.length) {
          // DESKTOP: használjuk a back oldalt is
          const backResult = fillSideByHeight(
            backEl,
            items,
            idx,
            baseName,
            pageNoInCat + 1,
            globalPageNo + 1,
            SAFE_MARGIN
          );
          usedBack = backResult.used;
          idx = backResult.nextIndex;
        } else {
          // MOBIL: a back oldal mindig üres marad
          clearSide(backEl);
        }

        // ha egyik oldalra sem fért fel tétel -> töröljük az üres lapot
        if (!usedFront && !usedBack) {
          pageEl.remove();
          break;
        }

        pages.push(pageEl);

        if (!isMobile) {
          // desktop: front+back -> 2-vel lépünk
          if (usedBack) {
            globalPageNo += 2;
            pageNoInCat += 2;
          } else if (usedFront) {
            globalPageNo += 1;
            pageNoInCat += 1;
          }
        } else {
          // mobil: csak front számít
          if (usedFront) {
            globalPageNo += 1;
            pageNoInCat += 1;
          }
        }
      }
    });

    // data-sheet + id
    pages.forEach((pageEl, index) => {
      const sheetIndex = index + 1;
      pageEl.dataset.sheet = String(sheetIndex);
      pageEl.id = `turn-${sheetIndex}`;
    });

    console.log(
      '[menu-book] Dinamikusan generált lapok száma (JSON+height):',
      pages.length,
      '| mód:', window.innerWidth <= 768 ? 'mobil' : 'desktop'
    );

    renumberPages(book); // folyamatos lapszámozás (mobilon csak front)
  }

  // Egy oldal (front vagy back) feltöltése annyi tétellel, amennyi kifér PIXEL ALAPON
  function fillSideByHeight(
    sideEl,
    items,
    startIndex,
    baseName,
    pageNoInCat,
    globalPageNo,
    SAFE_MARGIN
  ) {
    const titleEl = sideEl.querySelector('.title');
    const gridEl = sideEl.querySelector('.menu-items-grid');
    const numEl = sideEl.querySelector('.number-page');

    if (!gridEl) {
      return { nextIndex: startIndex, used: false };
    }

    gridEl.innerHTML = '';

    // Cím
    if (titleEl) {
      titleEl.textContent =
        pageNoInCat === 1 ? baseName : `${baseName} (${pageNoInCat})`;
    }
    if (numEl) {
      numEl.textContent = globalPageNo; // úgyis felülírja a renumberPages
    }

    // hasznos alsó határ
    const sideRect = sideEl.getBoundingClientRect();
    const maxBottom = sideRect.bottom - SAFE_MARGIN;

    let i = startIndex;
    let used = false;

    while (i < items.length) {
      const item = items[i];
      const art = renderMenuItem(item);
      gridEl.appendChild(art);

      const rect = art.getBoundingClientRect();
      if (rect.bottom > maxBottom) {
        // már nem fér ki -> visszavesszük
        gridEl.removeChild(art);
        break;
      }

      used = true;
      i++;
    }

    return { nextIndex: i, used };
  }

  function clearSide(sideEl) {
    if (!sideEl) return;
    const titleEl = sideEl.querySelector('.title');
    const gridEl = sideEl.querySelector('.menu-items-grid');
    const numEl = sideEl.querySelector('.number-page');
    if (titleEl) titleEl.textContent = '';
    if (gridEl) gridEl.innerHTML = '';
    if (numEl) numEl.textContent = '';
  }

  // Menü tétel DOM létrehozása
  function renderMenuItem(item) {
    const article = document.createElement('article');
    article.className = 'menu-item';

    const head = document.createElement('div');
    head.className = 'mi-head';

    const nameEl = document.createElement('h4');
    nameEl.className = 'mi-name';
    nameEl.textContent = item.name || '';
    head.appendChild(nameEl);

    if (item.price != null && item.price !== '') {
      const priceEl = document.createElement('div');
      priceEl.className = 'mi-price';
      if (typeof item.price === 'number') {
        priceEl.textContent = item.price.toFixed(2) + ' fr';
      } else {
        priceEl.textContent = String(item.price);
      }
      head.appendChild(priceEl);
    }

    article.appendChild(head);

    if (item.desc) {
      const descEl = document.createElement('p');
      descEl.className = 'mi-desc';
      descEl.textContent = item.desc;
      article.appendChild(descEl);
    }

    if (Array.isArray(item.tags) && item.tags.length) {
      const ul = document.createElement('ul');
      ul.className = 'mi-tags';
      item.tags.forEach((tag) => {
        const li = document.createElement('li');
        li.textContent = tag;
        ul.appendChild(li);
      });
      article.appendChild(ul);
    }

    if (Array.isArray(item.allergens) && item.allergens.length) {
      const ul = document.createElement('ul');
      ul.className = 'mi-tags allergens';
      item.allergens.forEach((a) => {
        const li = document.createElement('li');
        li.className = 'allergen';
        li.textContent = a;
        ul.appendChild(li);
      });
      article.appendChild(ul);
    }

    return article;
  }

  // Folyamatos lapszámozás
  // Desktop: front+back = 1,2,3,4...
  // Mobil: csak a front kap számot (1,2,3...), a back üres marad
  function renumberPages(book) {
    const pages = Array.from(book.querySelectorAll('.book-page.page-right'));
    const isMobile = window.innerWidth <= 768;
    let num = 1;

    pages.forEach((sheet) => {
      const frontNum = sheet.querySelector('.page-front .number-page');
      const backNum = sheet.querySelector('.page-back .number-page');

      if (isMobile) {
        if (frontNum) {
          frontNum.textContent = num++;
          frontNum.setAttribute('aria-label', `Oldalszám: ${frontNum.textContent}`);
        }
        if (backNum) {
          backNum.textContent = '';
          backNum.removeAttribute('aria-label');
        }
      } else {
        if (frontNum) {
          frontNum.textContent = num++;
          frontNum.setAttribute('aria-label', `Oldalszám: ${frontNum.textContent}`);
        }
        if (backNum) {
          backNum.textContent = num++;
          backNum.setAttribute('aria-label', `Oldalszám: ${backNum.textContent}`);
        }
      }
    });
  }

  // ============================================================
  // 2) Flipbook logika – ARIA + keyboard + touch
  // ============================================================
  function initMenuBook(root) {
    const book = root.querySelector('.book');
    const sheets = Array.from(root.querySelectorAll('.book .page-right'));
    const dotsWrap = root.querySelector('.book-dots');
    if (!book || sheets.length === 0) return;

    let pageIndex = 0;
    let isAnimating = false;
    const ANIM_MS = 600;

    // kezdő állapot
    sheets.forEach((el, i) => el.classList.toggle('turn', i > 0));

    // pöttyök + ARIA
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
        d.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') goTo(i);
        });
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

    // keyboard – nem aktív inputban
    document.addEventListener('keydown', (e) => {
      if (isAnimating) return;
      const act = document.activeElement;
      if (
        act &&
        (act.tagName === 'INPUT' ||
          act.tagName === 'TEXTAREA' ||
          act.isContentEditable)
      )
        return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    // touch swipe
    let touchX = 0;
    let touchY = 0;
    let moved = false;

    book.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          touchX = e.touches[0].clientX;
          touchY = e.touches[0].clientY;
          moved = false;
        }
      },
      { passive: true }
    );

    book.addEventListener(
      'touchmove',
      () => {
        moved = true;
      },
      { passive: true }
    );

    book.addEventListener(
      'touchend',
      (e) => {
        if (!moved || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = Math.abs(e.changedTouches[0].clientY - touchY);
        if (dy > 50) return; // nem oldalirány
        if (Math.abs(dx) > 60) {
          if (dx < 0) next();
          else prev();
        }
      },
      { passive: true }
    );

    refreshUI();
  }
})();
