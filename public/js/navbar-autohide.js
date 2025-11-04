// public/js/navbar-autohide.js
(() => {
  const nav = document.querySelector('.navbar.sticky-top');
  const navbarCollapse = document.querySelector('#navbarCollapse');
  const navbarToggler = document.querySelector('.navbar-toggler');
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

  // ========== AUTO-HIDE NAVBAR (görgetéskor) ==========
  if (nav) {
    let lastY = window.scrollY;
    let hidden = false;

    window.addEventListener(
      'scroll',
      () => {
        const y = window.scrollY;
        const down = y > lastY;
        lastY = y;

        if (down && y > 120 && !hidden) {
          hidden = true;
          nav.style.transition = 'transform 0.25s ease';
          nav.style.transform = 'translateY(-100%)';
        } else if (!down && hidden) {
          hidden = false;
          nav.style.transform = 'translateY(0)';
        }
      },
      { passive: true }
    );
  }

  // ========== MENÜ BEZÁRÁSA MOBILON ==========
  if (navbarCollapse) {
    // 1. Bezárás menüpontra kattintva
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navbarCollapse.classList.contains('show')) {
          // Bootstrap Collapse API használata
          const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
          if (bsCollapse) {
            bsCollapse.hide();
          } else {
            // Ha nincs instance, manuálisan
            navbarCollapse.classList.remove('show');
          }
        }
      });
    });

    // 2. Bezárás, ha a menün kívülre kattintasz (de NEM a hamburger ikonra!)
    document.addEventListener('click', (e) => {
      // Ellenőrizzük, hogy NEM a hamburger gombra vagy a menüre kattintott
      const isClickOnToggler = navbarToggler && navbarToggler.contains(e.target);
      const isClickInMenu = navbarCollapse.contains(e.target);

      // Csak akkor zárjuk be, ha a menün kívülre kattintott ÉS nem a toggler gombra
      if (!isClickOnToggler && !isClickInMenu && navbarCollapse.classList.contains('show')) {
        const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
        if (bsCollapse) {
          bsCollapse.hide();
        } else {
          navbarCollapse.classList.remove('show');
        }
      }
    });
  }

  // FONTOS: NE avatkozzunk a hamburger gomb működésébe!
  // A Bootstrap automatikusan kezeli a toggle-t.
})();
