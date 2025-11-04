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

  // ========== MENÜ BEZÁRÁSA ÉS TOGGLE ==========
  if (navbarCollapse && navbarToggler) {
    
    // 1. HAMBURGER IKON - MANUÁLIS TOGGLE (nyit/zár)
    navbarToggler.addEventListener('click', (e) => {
      e.preventDefault(); // Megállítjuk a Bootstrap default működését
      
      // Toggle: ha nyitva van → bezár, ha zárva van → nyit
      if (navbarCollapse.classList.contains('show')) {
        navbarCollapse.classList.remove('show');
        navbarToggler.classList.add('collapsed');
        navbarToggler.setAttribute('aria-expanded', 'false');
      } else {
        navbarCollapse.classList.add('show');
        navbarToggler.classList.remove('collapsed');
        navbarToggler.setAttribute('aria-expanded', 'true');
      }
    });

    // 2. Bezárás, ha menüpontra kattintasz
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navbarCollapse.classList.contains('show')) {
          navbarCollapse.classList.remove('show');
          navbarToggler.classList.add('collapsed');
          navbarToggler.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // 3. Bezárás, ha a menün KÍVÜLRE kattintasz (DE NEM a togglerre!)
    document.addEventListener('click', (e) => {
      const isClickOnToggler = navbarToggler.contains(e.target);
      const isClickInsideMenu = navbarCollapse.contains(e.target);

      if (!isClickOnToggler && !isClickInsideMenu && navbarCollapse.classList.contains('show')) {
        navbarCollapse.classList.remove('show');
        navbarToggler.classList.add('collapsed');
        navbarToggler.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
