// ============================================================
// feldiserhof-menu-book.js
// Dinamikus, magasság-alapú lapozás + flipbook navigáció
// Touch/Keyboard/ARIA/Resize/Lock support – TELJES VERZIÓ
// ============================================================

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('.menu-portfolio');
    if (!root) return console.warn('[menu-book] ".menu-portfolio" root elem nem található!');

    // Idempotens guard – ne inicializáljuk kétszer
    if (root.dataset.inited === '1') return;
    root.dataset.inited = '1';

    const menu = getMenuDataFromDom();
    if (menu && Array.isArray(menu.categories) && menu.categories.length) {
      buildDynamicPagesByHeight(root, menu);
    } else {
      console.warn(
        '[feldiserhof-menu-book] Nincs érvényes menuData (categories). ' +
          'Ellenőrizd a #menuDataScript JSON-t vagy a window.menuData változót.'
      );
    }

    // Flipbook inicializálás (akkor is, ha nincs menü adat)
    initMenuBookFlip(root);

    // Dinamikus újratördelés ablakméret változáskor (debounce: 500ms)
    let resizeTimeout = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        if (menu && Array.isArray(menu.categories) && menu.categories.length) {
          buildDynamicPagesByHeight(root, menu);
          initMenuBookFlip(root);
        }
      }, 500);
    });
  });

  // ---- Menü JSON kiolvasása a DOM-ból ----
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
  // 1) Dinamikus oldalgenerálás – MAGASSÁG ALAPJÁN
  // ============================================================
  function buildDynamicPagesByHeight(root, menu) {
    const book = root.querySelector('.book');
    if (!book) return;

    const SAFE_MARGIN = 8; // pár px mozgástér az oldal alján

    // Veszünk egy sablont a jobboldali lapról
    let template = book.querySelector('.book-page.page-right');

    if (template) {
      // kitakarítjuk, hogy üres sablon legyen
      template.querySelectorAll('.menu-items-grid').forEach((el) => (el.innerHTML = ''));
      template.querySelectorAll('.title').forEach((el) => (el.textContent = ''));
      template.querySelectorAll('.number-page').forEach((el) => (el.textContent = ''));
      template.remove(); // levesszük a DOM-ról, de a referenciát megtartjuk
    } else {
      // ha valamiért nincs, készítünk egy alap sablont
      template = document.createElement('div');
      template.className = 'book-page page-right';
      template.innerHTML = `
        <div class="page-front">
          <h1 class="title"></h1>
          <div class="menu-items-grid"></div>
          <span class="number-page"></span>
          <span class="nextprev-btn" data-role="next"><i class="bx bx-chevron-right"></i></span>
        </div>
        <div class="page-back">
          <h1 class="title"></h1>
          <div class="menu-items-grid"></div>
          <span class="number-page"></span>
          <span class="nextprev-btn back" data-role="prev"><i class="bx bx-chevron-left"></i></span>
        </div>
      `;
    }

    // Minden korábbi jobboldali lap törlése
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

      // Amíg van tétel az adott kategóriában
      while (idx < items.length) {
        const pageEl = template.cloneNode(true);
        book.appendChild(pageEl); // DOM-ban kell lennie, hogy mérni tudjunk

        const frontEl = pageEl.querySelector('.page-front');
        const backEl = pageEl.querySelector('.page-back');

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
        if (idx < items.length) {
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
          // ha nincs több tétel, a back oldal legyen üres
          clearSide(backEl);
        }

        pages.push(pageEl);

        if (usedBack) {
          globalPageNo += 2;
          pageNoInCat += 2;
        } else if (usedFront) {
          globalPageNo += 1;
          pageNoInCat += 1;
        } else {
          // biztonsági break (elvileg nem fordulhat elő)
          break;
        }
      }
    });

    // data-sheet + id beállítása a lapokra
    pages.forEach((pageEl, index) => {
      const sheetIndex = index + 1;
      pageEl.dataset.sheet = String(sheetIndex);
      pageEl.id = `turn-${sheetIndex}`;
    });

    console.log(
      '[feldiserhof-menu-book] Dinamikusan generált lapok száma:',
      pages.length
    );

    return pages;
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

    // Cím: első oldal sima, utána (2), (3) stb.
    if (titleEl) {
      titleEl.textContent =
        pageNoInCat === 1 ? baseName : `${baseName} (${pageNoInCat})`;
    }
    if (numEl) {
      numEl.textContent = globalPageNo;
      numEl.setAttribute('aria-label', `Oldalszám: ${globalPageNo}`);
    }

    // Megnézzük az oldal hasznos alsó határát
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
        // ez már nem fér ki -> visszavesszük
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

  // Menü tétel DOM létrehozása (ugyanaz a markup, mint az EJS-ben)
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

  // ============================================================
  // 2) Flipbook logika (lapozás, pöttyök, lock, ARIA, touch)
  // ============================================================
  function initMenuBookFlip(root) {
    const book = root.querySelector('.book');
    if (!book) return;

    const guard =
      root.querySelector('#menuBookGuard') || root.querySelector('.book-guard');

    const enabled =
      (guard && String(guard.dataset.enabled) === 'true') ||
      !!(window.FEATURES && window.FEATURES.menuBookEnabled) ||
      true; // ha nincs info, inkább legyen nyitott

    const sheets = Array.from(root.querySelectorAll('.book .page-right'));
    const btnPrev = root.querySelector('.book-btn.prev');
    const btnNext = root.querySelector('.book-btn.next');
    const dotsWrap = root.querySelector('.book-dots');

    if (!sheets.length) {
      console.warn(
        '[feldiserhof-menu-book] Nincsenek .page-right lapok – valószínűleg a dinamikus generálás nem futott le.'
      );
      return;
    }

    // Lock vizuális állapot
    if (!enabled) {
      guard?.classList.add('book--locked');
      book.classList.add('book--locked');
    } else {
      guard?.classList.remove('book--locked');
      book.classList.remove('book--locked');
    }

    let pageIndex = 0;
    let isAnimating = false;
    const ANIM_MS = 600;

    // Alapállapot: csak az első nincs "turn" alatt
    sheets.forEach((el, i) => el.classList.toggle('turn', i > 0));

    // Pöttyök + ARIA navigáció
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      dots = sheets.map((_, i) => {
        const d = document.createElement('span');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        d.setAttribute('role', 'button');
        d.setAttribute('tabindex', '0');
        d.setAttribute('aria-label', `Ugrás a ${i + 1}. lapra`);
        d.addEventListener('click', () => goTo(i));
        d.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            goTo(i);
          }
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
    const setDisabled = (el, disabled) => {
      if (el) el.disabled = !!disabled;
    };
    const isLocked = () => !enabled;

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

      setDisabled(btnPrev, isLocked() || pageIndex === 0);
      setDisabled(btnNext, isLocked() || pageIndex === sheets.length - 1);

      dots.forEach((d, i) => {
        d.classList.toggle('active', i === pageIndex);
        if (isLocked()) d.classList.add('disabled');
        else d.classList.remove('disabled');
      });

      root.querySelectorAll('.nextprev-btn').forEach((b) => {
        b.classList.remove('is-disabled');
        if (isLocked()) b.classList.add('is-disabled');
      });

      if (!isLocked()) {
        const current = sheets[pageIndex];
        const frontNext = current?.querySelector(
          '.page-front .nextprev-btn[data-role="next"]'
        );
        const backPrev = current?.querySelector(
          '.page-back  .nextprev-btn[data-role="prev"]'
        );
        if (pageIndex === sheets.length - 1 && frontNext)
          frontNext.classList.add('is-disabled');
        if (pageIndex === 0 && backPrev) backPrev.classList.add('is-disabled');
      }
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
      if (isAnimating || isLocked()) return;
      isAnimating = true;

      const movingIdx = newIndex > oldIndex ? oldIndex : newIndex;
      boostForAnimation(movingIdx);

      refreshUI();

      setTimeout(() => {
        isAnimating = false;
      }, ANIM_MS);
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

    function lockedNudge() {
      guard?.classList.add('shake');
      book.classList.add('shake');
      setTimeout(() => {
        guard?.classList.remove('shake');
        book.classList.remove('shake');
      }, 400);
    }

    // Belső nyilak
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.nextprev-btn');
      if (!btn || !root.contains(btn)) return;
      if (btn.classList.contains('is-disabled') || isLocked())
        return lockedNudge();
      const role = btn.getAttribute('data-role');
      if (role === 'next') next();
      if (role === 'prev') prev();
    });

    // Külső prev/next
    if (btnPrev)
      btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        if (isLocked()) return lockedNudge();
        prev();
      });
    if (btnNext)
      btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        if (isLocked()) return lockedNudge();
        next();
      });

    // Billentyűk – NEM aktív input/textarea mezőben!
    document.addEventListener('keydown', (e) => {
      if (isAnimating || isLocked()) return;
      
      // Ha épp input/textarea/contentEditable fókuszban van, skip
      const act = document.activeElement;
      if (act && (act.tagName === 'INPUT' || act.tagName === 'TEXTAREA' || act.isContentEditable)) return;

      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Home' && pageIndex !== 0) {
        const old = pageIndex;
        pageIndex = 0;
        updateBookView(old, pageIndex);
      }
      if (e.key === 'End' && pageIndex !== sheets.length - 1) {
        const old = pageIndex;
        pageIndex = sheets.length - 1;
        updateBookView(old, pageIndex);
      }
    });

    // Touch-swipe támogatás
    let sx = 0, sy = 0, moved = false;
    
    root.addEventListener('touchstart', (e) => {
      if (isLocked()) return;
      if (!e.changedTouches || !e.changedTouches[0]) return;
      sx = e.changedTouches[0].screenX;
      sy = e.changedTouches[0].screenY;
      moved = false;
    }, { passive: true });

    root.addEventListener('touchmove', () => {
      moved = true;
    }, { passive: true });

    root.addEventListener('touchend', (e) => {
      if (isAnimating || isLocked() || !moved || !e.changedTouches || !e.changedTouches[0]) return;
      const ex = e.changedTouches[0].screenX;
      const ey = e.changedTouches[0].screenY;
      const dx = ex - sx;
      const dy = Math.abs(ey - sy);
      
      // Csak vízszintes swipe esetén
      if (dy < 50 && Math.abs(dx) > 60) {
        if (dx < 0) next();  // balra húzás = előre
        else prev();         // jobbra húzás = vissza
      }
    }, { passive: true });

    // Magasság igazítás (desktop)
    function adjustBookHeight() {
      if (!book) return;
      if (window.innerWidth > 768) {
        const vh = window.innerHeight;
        const nav = document.querySelector('nav');
        const foot = document.querySelector('footer');
        const navH = nav ? nav.offsetHeight : 0;
        const footH = foot ? foot.offsetHeight : 0;
        const h = Math.max(vh - navH - footH - 100, 500);
        book.style.minHeight = h + 'px';
      } else {
        book.style.minHeight = '';
      }
    }
    window.addEventListener('load', adjustBookHeight, { once: true });
    window.addEventListener('resize', adjustBookHeight);

    refreshUI();
    adjustBookHeight();

    console.log(
      '[feldiserhof-menu-book] Flipbook lapok:',
      sheets.length,
      '| enabled:',
      enabled
    );
  }
})();
