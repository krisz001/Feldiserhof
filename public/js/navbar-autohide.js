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
    // 1. Bezárás, ha menüpontra kattintasz
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navbarCollapse.classList.contains('show')) {
          // Bootstrap Collapse API használata
          const bsCollapse = 
            bootstrap.Collapse.getInstance(navbarCollapse) ||
            new bootstrap.Collapse(navbarCollapse, { toggle: false });
          bsCollapse.hide();
        }
      });
    });

    // 2. Bezárás, ha a menün kívülre kattintasz (opcionális)
    document.addEventListener('click', (e) => {
      const isClickInsideNav =
        navbarCollapse.contains(e.target) ||
        (navbarToggler && navbarToggler.contains(e.target));

      if (!isClickInsideNav && navbarCollapse.classList.contains('show')) {
        const bsCollapse =
          bootstrap.Collapse.getInstance(navbarCollapse) ||
          new bootstrap.Collapse(navbarCollapse, { toggle: false });
        bsCollapse.hide();
      }
    });
  }
})();
