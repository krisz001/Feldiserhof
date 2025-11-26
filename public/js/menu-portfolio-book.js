// ============================================================
// menu-portfolio-book.js
// 1) PDF alapú egyszerű lapozó (FELDISERHOF_PDF_PAGES vagy data-pdf-pages)
// 2) Menü JSON -> dinamikus, magasság alapú lapozás + fejlett flipbook
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

    if (root.dataset.inited === '1') return;
    root.dataset.inited = '1';

    const book = root.querySelector('.book');
    if (!book) {
      console.warn('[menu-book] ".book" elem nem található!');
      return;
    }

    // 0) PDF KONFIGURÁCIÓ
    let pdfPages = [];
    if (window.menuData?.pdfMode && Array.isArray(window.menuData.pdfPages)) {
      pdfPages = window.menuData.pdfPages;
    } else if (window.FELDISERHOF_PDF_PAGES && Array.isArray(window.FELDISERHOF_PDF_PAGES)) {
      pdfPages = window.FELDISERHOF_PDF_PAGES;
    } else if (book.hasAttribute('data-pdf-pages')) {
      const dataAttr = book.getAttribute('data-pdf-pages');
      if (dataAttr) {
        try {
          pdfPages = JSON.parse(dataAttr);
        } catch (e) {
          console.error('[menu-book] PDF pages JSON parse error:', e);
        }
      }
    }

    if (pdfPages && pdfPages.length > 0) {
      initPdfMenuBook(book, pdfPages);
      return;
    }

    // 1) DINAMIKUS JSON ÉPÍTÉS
    const menu = getMenuDataFromDom();
    if (menu && Array.isArray(menu.categories) && menu.categories.length) {
      buildDynamicPagesByHeight(root, menu);
    } else {
      console.warn('[menu-book] Nincs érvényes menuData.');
    }

    // 2) FLIPBOOK INDÍTÁS
    initMenuBook(root);
  });

  // ============================================================
  // PDF MÓD
  // ============================================================
  function initPdfMenuBook(bookEl, pdfPages) {
    bookEl.innerHTML = '';
    const root = bookEl.closest('.menu-portfolio');
    if (root) root.classList.add('has-pdf');

    if (!pdfPages || pdfPages.length === 0) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      // Mobil: szimpla lapok
      for (let i = 0; i < pdfPages.length; i++) {
        const pageEl = createPageElement(i + 1);
        const frontEl = pageEl.querySelector('.page-front');
        const backEl = pageEl.querySelector('.page-back'); // Üres, de kell a struktúrához

        if (pdfPages[i]) {
          const img = document.createElement('img');
          img.src = pdfPages[i];
          img.className = 'menu-book-page-img';
          frontEl.appendChild(img);
        }
        addPageNumber(frontEl, i + 1);
        
        addNavButtons(frontEl, i > 0, i + 1 < pdfPages.length);
        bookEl.appendChild(pageEl);
      }
    } else {
      // Desktop: párosított lapok
      for (let i = 0; i < pdfPages.length; i += 2) {
        const pageEl = createPageElement(Math.floor(i / 2) + 1);
        const frontEl = pageEl.querySelector('.page-front');
        const backEl = pageEl.querySelector('.page-back');

        // Front (Jobb)
        if (pdfPages[i]) {
          const img = document.createElement('img');
          img.src = pdfPages[i];
          img.className = 'menu-book-page-img';
          frontEl.appendChild(img);
        }
        addPageNumber(frontEl, i + 1);
        // Next gomb a frontra, ha van még oldal
        if (i + 2 < pdfPages.length) addNextButton(frontEl);

        // Back (Bal)
        if (pdfPages[i + 1]) {
          const img = document.createElement('img');
          img.src = pdfPages[i + 1];
          img.className = 'menu-book-page-img';
          backEl.appendChild(img);
          addPageNumber(backEl, i + 2);
        }
        // Prev gomb a backre mindig
        addPrevButton(backEl);

        bookEl.appendChild(pageEl);
      }
    }

    if (root) initMenuBook(root);
  }

  // Segéd: Lap létrehozása alap struktúrával
  function createPageElement(index) {
    const pageEl = document.createElement('div');
    pageEl.className = 'book-page page-right';
    pageEl.dataset.sheet = String(index);
    pageEl.id = `turn-${index}`;

    const front = document.createElement('div');
    front.className = 'page-front';
    const back = document.createElement('div');
    back.className = 'page-back';

    pageEl.appendChild(front);
    pageEl.appendChild(back);
    return pageEl;
  }

  function addPageNumber(el, num) {
    const span = document.createElement('span');
    span.className = 'number-page';
    span.textContent = String(num);
    el.appendChild(span);
  }

  function addNextButton(el) {
    const btn = document.createElement('button');
    btn.className = 'nextprev-btn btn-next';
    btn.type = 'button';
    btn.dataset.role = 'next';
    btn.textContent = '›';
    el.appendChild(btn);
  }

  function addPrevButton(el) {
    const btn = document.createElement('button');
    btn.className = 'nextprev-btn btn-back';
    btn.type = 'button';
    btn.dataset.role = 'prev';
    btn.textContent = '‹';
    el.appendChild(btn);
  }

  function addNavButtons(el, hasPrev, hasNext) {
    if (hasPrev) addPrevButton(el);
    if (hasNext) addNextButton(el);
  }

  function getMenuDataFromDom() {
    const script = document.getElementById('menuDataScript');
    if (script && script.textContent.trim()) {
      try { return JSON.parse(script.textContent); } catch (e) {}
    }
    return window.menuData || null;
  }

  // ============================================================
  // 1) DINAMIKUS ÉPÍTÉS (Logic Fix: Extra Page)
  // ============================================================
  function buildDynamicPagesByHeight(root, menu) {
    const book = root.querySelector('.book');
    if (!book) return;

    const SAFE_MARGIN = 8;
    const isMobile = window.innerWidth <= 768;

    // Sablon kimentése
    const templateOriginal = book.querySelector('.book-page.page-right');
    if (!templateOriginal) {
      console.error('[menu-book] Sablon hiba.');
      return;
    }
    const template = templateOriginal.cloneNode(true);
    // Sablon takarítás
    template.querySelectorAll('.menu-items-grid').forEach(el => el.innerHTML = '');
    template.querySelectorAll('.title').forEach(el => el.textContent = '');
    template.querySelectorAll('.number-page').forEach(el => el.textContent = '');
    
    // Gombok beállítása a sablonon: Front=Next, Back=Prev
    const tplFrontBtn = template.querySelector('.page-front .nextprev-btn');
    if (tplFrontBtn) { tplFrontBtn.className = 'nextprev-btn btn-next'; tplFrontBtn.textContent = '›'; tplFrontBtn.dataset.role = 'next'; }
    const tplBackBtn = template.querySelector('.page-back .nextprev-btn');
    if (tplBackBtn) { tplBackBtn.className = 'nextprev-btn btn-back'; tplBackBtn.textContent = '‹'; tplBackBtn.dataset.role = 'prev'; }

    // Régi lapok törlése
    book.querySelectorAll('.book-page.page-right').forEach(p => p.remove());

    const pages = [];
    let globalPageNo = 1;
    const categories = Array.isArray(menu.categories) ? menu.categories : [];

    // Lapozási változók
    let currentCatIndex = 0;
    let currentItemIndex = 0; // Hol tartunk a jelenlegi kategóriában
    
    // Fő ciklus: addig megyünk, amíg van kategória
    while (currentCatIndex < categories.length) {
        const cat = categories[currentCatIndex];
        const items = Array.isArray(cat.items) ? cat.items : [];
        const baseName = cat.name || `Kategorie ${currentCatIndex + 1}`;
        
        // Ha üres a kategória, ugorjunk
        if (items.length === 0) {
            currentCatIndex++;
            continue;
        }

        // Létrehozunk egy új fizikai lapot
        const pageEl = template.cloneNode(true);
        const frontEl = pageEl.querySelector('.page-front');
        const backEl = pageEl.querySelector('.page-back');
        let usedFront = false;
        let usedBack = false;

        // 1. Töltsük a FRONT (jobb) oldalt
        const frontRes = fillSideByHeight(frontEl, items, currentItemIndex, baseName, globalPageNo, SAFE_MARGIN);
        usedFront = frontRes.used;
        currentItemIndex = frontRes.nextIndex; // Frissítjük, meddig jutottunk

        // Ha vége a kategóriának a fronton, lépjünk a kövire (ha van), hátha ráfér még
        // (Egyszerűsítés: most kategóriánként új oldalt kezdünk általában, de a `while` struktúra engedné a folytatást. 
        //  A jelenlegi logika szerint egy oldalon belül egy kategória van a fillSideByHeight hívás miatt.)
        
        // Ellenőrizzük: Kifogytunk a jelenlegi kategóriából?
        if (currentItemIndex >= items.length) {
            currentCatIndex++; // Jöhet a következő kategória (a köv. iterációban vagy a hátoldalon)
            currentItemIndex = 0; // Reset az új kategóriához
        }

        // Különleges eset: Ha végeztünk az ÖSSZES tartalommal a Front oldalon
        if (currentCatIndex >= categories.length) {
            // === TARTALOM VÉGE A FRONTON ===
            // Azaz: Front tele van, Back üres.
            // IDE kell rakni a záróüzenetet a Back oldalra.
            if (!isMobile) {
                renderThankYouMessage(backEl);
                usedBack = true;
            }
            pages.push(pageEl);
            break; // Végeztünk mindennel
        }

        // 2. Töltsük a BACK (bal) oldalt - ha nem mobil
        if (!isMobile) {
             // Van még tartalom (a köv. kategóriából, vagy a jelenlegiből, ha a fillSideByHeight támogatná a töredéket, 
             // de itt most egyszerűsítsünk: a loop eleje kezeli a cat indexet).
             // Itt újra kellene hívni a fillt a *következő* adaggal.
             
             // Mivel a fillSideByHeight csak egy adott listából dolgozik, itt a logikát úgy kell folytatni:
             if (currentCatIndex < categories.length) {
                 const nextCat = categories[currentCatIndex];
                 const nextItems = nextCat.items || [];
                 const nextBaseName = nextCat.name;
                 
                 const backRes = fillSideByHeight(backEl, nextItems, currentItemIndex, nextBaseName, globalPageNo + 1, SAFE_MARGIN);
                 usedBack = backRes.used;
                 currentItemIndex = backRes.nextIndex;

                 if (currentItemIndex >= nextItems.length) {
                     currentCatIndex++;
                     currentItemIndex = 0;
                 }
             }
        } else {
            clearSide(backEl);
        }

        pages.push(pageEl);

        // Ellenőrizzük: Kifogytunk az ÖSSZES tartalomból a Back oldal után?
        if (currentCatIndex >= categories.length && !isMobile) {
             // === TARTALOM VÉGE A BACK OLDALON ===
             // Azaz: Front tele, Back tele.
             // Kell egy ÚJ LAP a záróüzenetnek.
             
             const extraPage = template.cloneNode(true);
             const exFront = extraPage.querySelector('.page-front');
             const exBack = extraPage.querySelector('.page-back');
             
             // Frontra tesszük az üzenetet
             renderThankYouMessage(exFront);
             // Back üres
             clearSide(exBack);
             
             // Gombok kezelése az extra lapon
             // Front: Nincs Next gomb (vége)
             const nextBtn = exFront.querySelector('.nextprev-btn[data-role="next"]');
             if (nextBtn) nextBtn.remove();
             
             // Back: Kell Prev gomb (hogy vissza lehessen jönni az üres hátlapra - bár oda nem jutunk el logikailag, 
             // de a lapozó szerkezet miatt kell)
             
             pages.push(extraPage);
             break;
        }

        // Oldalszámláló növelése
        globalPageNo += isMobile ? 1 : 2;
    }

    // Ha mobil és végeztünk, a záróüzenetet egy külön lapra rakjuk
    if (isMobile) {
        const extraPage = template.cloneNode(true);
        const exFront = extraPage.querySelector('.page-front');
        const exBack = extraPage.querySelector('.page-back');
        renderThankYouMessage(exFront); // Fronton jelenik meg mobilon is
        // Mobilon a Back oldalt nem látjuk, de a struktúra miatt ott van.
        const nextBtn = exFront.querySelector('.nextprev-btn[data-role="next"]');
        if (nextBtn) nextBtn.remove();
        
        // Mobilon a Frontra kell Prev gomb
        let prevBtn = exFront.querySelector('.nextprev-btn[data-role="prev"]');
        if (!prevBtn) {
             prevBtn = document.createElement('button');
             prevBtn.className = 'nextprev-btn btn-back';
             prevBtn.textContent = '‹';
             prevBtn.dataset.role = 'prev';
             exFront.appendChild(prevBtn);
        }
        pages.push(extraPage);
    }


    // DOM-ba helyezés
    pages.forEach((p, i) => {
        p.dataset.sheet = String(i + 1);
        p.id = `turn-${i + 1}`;
        book.appendChild(p);
        
        // Az utolsó lap Frontjáról mindig leszedjük a Next gombot (biztonsági okból)
        if (i === pages.length - 1) {
             const lastNext = p.querySelector('.page-front .nextprev-btn[data-role="next"]');
             if (lastNext) lastNext.remove();
        }
    });
    
    renumberPages(book);
    setupMobileArrows(book);
  }

  // --- Záróüzenet ---
  function renderThankYouMessage(sideEl) {
    if (!sideEl) return;
    clearSide(sideEl);

    const gridEl = sideEl.querySelector('.menu-items-grid');
    if (!gridEl) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.height = '100%';
    container.style.textAlign = 'center';
    container.style.padding = '20px';

    const msgTitle = document.createElement('h3');
    msgTitle.textContent = '[translate:Wir wünschen Ihnen einen guten Appetit!]'; 
    msgTitle.style.marginBottom = '15px';
    msgTitle.style.fontFamily = 'var(--font-heading, serif)';
    
    const msgText = document.createElement('p');
    msgText.textContent = '[translate:Danke für Ihren Besuch.]';
    msgText.style.marginBottom = '30px';

    const restartBtn = document.createElement('button');
    restartBtn.textContent = '[translate:Zurück zum Anfang]';
    restartBtn.className = 'btn-custom-restart';
    restartBtn.style.padding = '10px 20px';
    restartBtn.style.border = '1px solid currentColor';
    restartBtn.style.background = 'transparent';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.textTransform = 'uppercase';
    restartBtn.style.marginTop = '10px';
    restartBtn.dataset.role = 'restart';

    container.appendChild(msgTitle);
    container.appendChild(msgText);
    container.appendChild(restartBtn);
    gridEl.appendChild(container);

    // Biztosítjuk a Vissza gombot (ha ez Back oldal, akkor eleve ott van, ha Front, akkor nem volt ott)
    // Ha ez egy Front oldal (új lap), akkor nincs ott alapból a btn-back, mert a sablonban ott btn-next van.
    let existingNext = sideEl.querySelector('.nextprev-btn[data-role="next"]');
    if (existingNext) existingNext.remove();

    let prevBtn = sideEl.querySelector('.nextprev-btn[data-role="prev"]');
    if (!prevBtn) {
        prevBtn = document.createElement('button');
        prevBtn.className = 'nextprev-btn btn-back';
        prevBtn.textContent = '‹';
        prevBtn.dataset.role = 'prev';
        sideEl.appendChild(prevBtn);
    }
  }

  function fillSideByHeight(sideEl, items, startIndex, titleText, pageNum, safeMargin) {
    const titleEl = sideEl.querySelector('.title');
    const gridEl = sideEl.querySelector('.menu-items-grid');
    const numEl = sideEl.querySelector('.number-page');

    if (!gridEl) return { nextIndex: startIndex, used: false };

    gridEl.innerHTML = '';
    if (titleEl) titleEl.textContent = titleText;
    if (numEl) numEl.textContent = pageNum;

    const maxBottom = sideEl.getBoundingClientRect().bottom - safeMargin;
    let i = startIndex;
    let used = false;

    while (i < items.length) {
      const item = items[i];
      const art = renderMenuItem(item);
      gridEl.appendChild(art);
      
      if (art.getBoundingClientRect().bottom > maxBottom) {
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

  function renderMenuItem(item) {
    const article = document.createElement('article');
    article.className = 'menu-item';
    
    const head = document.createElement('div');
    head.className = 'mi-head';
    
    const nameEl = document.createElement('h4');
    nameEl.className = 'mi-name';
    nameEl.textContent = item.name || '';
    head.appendChild(nameEl);

    if (item.price) {
      const priceEl = document.createElement('div');
      priceEl.className = 'mi-price';
      priceEl.textContent = (typeof item.price === 'number') ? item.price.toFixed(2) + ' fr' : item.price;
      head.appendChild(priceEl);
    }
    article.appendChild(head);

    if (item.desc) {
      const p = document.createElement('p');
      p.className = 'mi-desc';
      p.textContent = item.desc;
      article.appendChild(p);
    }
    if (item.tags && item.tags.length) {
      const ul = document.createElement('ul');
      ul.className = 'mi-tags';
      item.tags.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
      article.appendChild(ul);
    }
    if (item.allergens && item.allergens.length) {
      const ul = document.createElement('ul');
      ul.className = 'mi-tags allergens';
      item.allergens.forEach(a => { const li = document.createElement('li'); li.className = 'allergen'; li.textContent = a; ul.appendChild(li); });
      article.appendChild(ul);
    }
    return article;
  }

  function renumberPages(book) {
    let num = 1;
    book.querySelectorAll('.book-page.page-right').forEach(page => {
       const f = page.querySelector('.page-front .number-page');
       const b = page.querySelector('.page-back .number-page');
       // Ha mobilon vagyunk, a back oldalon nem kell szám
       if (window.innerWidth <= 768) {
           if (f) f.textContent = num++;
           if (b) b.textContent = '';
       } else {
           if (f) f.textContent = num++;
           if (b) {
               // Ha ez az utolsó lap és üres a back, akkor is számozzuk, ha akarjuk,
               // de ha a "Köszönjük" üzenet van ott, akkor ne legyen szám? 
               // A felhasználó nem kérte, hogy ne legyen, így hagyjuk a folyamatos számozást.
               b.textContent = num++;
           }
       }
    });
  }

  function setupMobileArrows(book) {
    if (window.innerWidth > 768) return;
    book.querySelectorAll('.book-page.page-right').forEach(page => {
        const front = page.querySelector('.page-front');
        if (!front) return;
        // Ha nincs Back gomb a Fronton, de ez nem az első oldal, hozzuk át/hozzuk létre
        if (!front.querySelector('.nextprev-btn[data-role="prev"]')) {
             const btn = document.createElement('button');
             btn.className = 'nextprev-btn btn-back';
             btn.textContent = '‹';
             btn.dataset.role = 'prev';
             // Csak akkor adjuk hozzá, ha ez nem a legelső lap (ahol pageIndex=0)
             // De a loopban nem tudjuk az indexet könnyen, viszont a DOM sorrend segít.
             // Ha ez az első gyerek, ne adjunk.
             if (page.previousElementSibling) {
                 front.appendChild(btn);
             }
        }
    });
  }

  // ============================================================
  // FLIPBOOK LOGIKA
  // ============================================================
  function initMenuBook(root) {
    const book = root.querySelector('.book');
    const sheets = Array.from(root.querySelectorAll('.book .page-right'));
    const dotsWrap = root.querySelector('.book-dots');
    if (!book || sheets.length === 0) return;

    let pageIndex = 0;
    let isAnimating = false;
    const ANIM_MS = 600;

    sheets.forEach((el, i) => el.classList.toggle('turn', i > 0));

    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      sheets.forEach((_, i) => {
        const d = document.createElement('span');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        d.onclick = () => goTo(i);
        dotsWrap.appendChild(d);
      });
    }

    function clamp(i) { return Math.max(0, Math.min(sheets.length, i)); }
    function baseZ(i, turned) { return turned ? i + 1 : sheets.length * 2 - i; }

    function refreshUI() {
      sheets.forEach((el, i) => {
        const turned = i < pageIndex;
        el.classList.toggle('turn', turned);
        if (!el.dataset.boost) el.style.zIndex = baseZ(i, turned);
      });
      if (dotsWrap) {
        const dots = dotsWrap.querySelectorAll('.dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === Math.min(pageIndex, sheets.length - 1)));
      }
    }

    function updateView(newIdx) {
      if (isAnimating) return;
      isAnimating = true;
      const oldIdx = pageIndex;
      const movingIdx = newIdx > oldIdx ? oldIdx : newIdx;
      
      const el = sheets[movingIdx];
      if (el) {
          el.dataset.boost = '1';
          el.style.zIndex = sheets.length * 5;
      }
      pageIndex = newIdx;
      refreshUI();
      
      setTimeout(() => {
        if (el) {
            delete el.dataset.boost;
            const turned = movingIdx < pageIndex;
            el.style.zIndex = baseZ(movingIdx, turned);
        }
        isAnimating = false;
      }, ANIM_MS);
    }

    function next() { if (pageIndex < sheets.length) updateView(clamp(pageIndex + 1)); }
    function prev() { if (pageIndex > 0) updateView(clamp(pageIndex - 1)); }
    function goTo(i) { 
        if (isAnimating || i === pageIndex) return;
        // Egyszerűsített ugrás: csak beállítjuk
        pageIndex = clamp(i);
        refreshUI(); 
        // (Animált ugrás bonyolultabb lenne a boost miatt, most egyszerűsítve)
    }

    root.addEventListener('click', (e) => {
      const target = e.target;
      if (target.closest('[data-role="restart"]')) {
          goTo(0);
          return;
      }
      const btn = target.closest('.nextprev-btn');
      if (btn && root.contains(btn)) {
          const role = btn.dataset.role;
          if (role === 'next') next();
          if (role === 'prev') prev();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (isAnimating || ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });
    
    // Swipe
    let tX = 0, tY = 0, moved = false;
    book.addEventListener('touchstart', e => { tX=e.touches[0].clientX; tY=e.touches[0].clientY; moved=false; }, {passive:true});
    book.addEventListener('touchmove', () => moved=true, {passive:true});
    book.addEventListener('touchend', e => {
        if(!moved) return;
        const dx = e.changedTouches[0].clientX - tX;
        const dy = Math.abs(e.changedTouches[0].clientY - tY);
        if(dy > 50) return;
        if(Math.abs(dx) > 60) (dx < 0) ? next() : prev();
    }, {passive:true});

    refreshUI();
  }
})();