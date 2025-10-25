/* Feldiserhof – dinamikus „könyvlap” mozgás, az eredeti turn-logikával
   Elvárás: minden .book-page.page-right elemen induláskor legyen .turn class!
   Szerkezet:
     .book-page.page-right.turn   // zárt lap (jobb oldal)
     .nextprev-btn                // belső saroknyilak (front: előre, back: vissza)
     .book-btn.prev/.next         // külső vezérlők
*/

(() => {
  const root = document.querySelector('.menu-portfolio');
  if (!root) return;

  const turns = Array.from(root.querySelectorAll('.book-page.page-right'));
  if (!turns.length) return;

  const btnPrev = root.querySelector('.book-btn.prev');
  const btnNext = root.querySelector('.book-btn.next');

  const coverRight = root.querySelector('.cover.cover-right'); // ha nincs, nem baj

  // ----- eredeti nyitó anim (cascade) -----
  // induláskor MIND zárt (class "turn") legyen: ezt a HTML-ben már így rendereld!
  let totalPages = turns.length;
  let pageNumber = 0;

  function reverseIndex() {
    pageNumber--;
    if (pageNumber < 0) pageNumber = totalPages - 1;
  }

  // borító-anim (opcionális, ha van elem)
  setTimeout(() => { coverRight && coverRight.classList.add('turn'); }, 800);
  setTimeout(() => { if (coverRight) coverRight.style.zIndex = -1; }, 1400);

  // könyv lapról-lapra „nyitása” (pont mint az eredetiben)
  turns.forEach((_, index) => {
    setTimeout(() => {
      reverseIndex();
      turns[pageNumber].classList.remove('turn');             // kinyit
      setTimeout(() => {
        reverseIndex();
        turns[pageNumber].style.zIndex = 10 + index;          // zIndex újrasorolás
      }, 500);
    }, (index + 1) * 180 + 900); // kicsit gyorsabb, feszesebb
  });

  // ----- belső saroknyilak (#data-page alapján) -----
  root.querySelectorAll('.nextprev-btn').forEach((el, index) => {
    el.addEventListener('click', () => {
      const pageTurnId = el.getAttribute('data-page');
      const pageTurn = document.getElementById(pageTurnId);
      if (!pageTurn) return;

      if (pageTurn.classList.contains('turn')) {
        // zárt → nyit
        pageTurn.classList.remove('turn');
        setTimeout(() => { pageTurn.style.zIndex = 2 - index; }, 500);
      } else {
        // nyitott → zár
        pageTurn.classList.add('turn');
        setTimeout(() => { pageTurn.style.zIndex = 2 + index; }, 500);
      }
    });
  });

  // ----- külső prev/next gombok (logikus lapozás) -----
  // aktuális nyitott „legutolsó” index meghatározása
  const currentIndex = () =>
    Math.max(0, turns.findIndex(p => !p.classList.contains('turn')));

  function go(step) {
    // keresünk következő zárandó/nyitandó lapot
    let i = currentIndex();
    if (i < 0) i = 0;

    if (step > 0) {
      // előre: a következő zárt lapot kinyitjuk
      const next = turns.find((p, idx) => idx >= i && p.classList.contains('turn')) ||
                   turns.find(p => p.classList.contains('turn'));
      if (!next) return;
      next.classList.remove('turn');
      setTimeout(() => { next.style.zIndex = 50 + i; }, 500);
    } else {
      // vissza: a legutóbb nyitott lapot visszazárjuk
      const openList = turns.filter(p => !p.classList.contains('turn'));
      const lastOpen = openList[openList.length - 1];
      if (!lastOpen) return;
      lastOpen.classList.add('turn');
      setTimeout(() => { lastOpen.style.zIndex = 2 + i; }, 500);
    }
  }

  btnPrev && btnPrev.addEventListener('click', () => go(-1));
  btnNext && btnNext.addEventListener('click', () => go(1));

  // ----- swipe gesztus (egyszerű) -----
  let startX = null;
  root.addEventListener('pointerdown', e => { startX = e.clientX; }, { passive: true });
  root.addEventListener('pointerup', e => {
    if (startX == null) return;
    const dx = e.clientX - startX; startX = null;
    const TH = 60;
    if (dx > TH) go(-1);
    else if (dx < -TH) go(1);
  }, { passive: true });
})();
