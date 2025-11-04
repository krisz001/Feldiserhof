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

  // ========== HAMBURGER TOGGLE ÉS MENÜ BEZÁRÁS ==========
  if (navbarCollapse && navbarToggler) {
    
    // 1. HAMBURGER IKON KATTINTÁS - Toggle (nyit/zár + X animáció)
    navbarToggler.addEventListener('click', (e) => {
      e.preventDefault();
      
      const isOpen = navbarCollapse.classList.contains('show');
      
      if (isOpen) {
        // BEZÁRÁS
        navbarCollapse.classList.remove('show');
        navbarToggler.classList.remove('active');
        navbarToggler.classList.add('collapsed');
        navbarToggler.setAttribute('aria-expanded', 'false');
      } else {
        // NYITÁS
        navbarCollapse.classList.add('show');
        navbarToggler.classList.add('active');
        navbarToggler.classList.remove('collapsed');
        navbarToggler.setAttribute('aria-expanded', 'true');
      }
    });

    // 2. Bezárás, ha menüpontra kattintasz
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navbarCollapse.classList.contains('show')) {
          navbarCollapse.classList.remove('show');
          navbarToggler.classList.remove('active');
          navbarToggler.classList.add('collapsed');
          navbarToggler.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // 3. Bezárás, ha a menün kívülre kattintasz
    document.addEventListener('click', (e) => {
      const isClickOnToggler = navbarToggler.contains(e.target);
      const isClickInsideMenu = navbarCollapse.contains(e.target);

      if (!isClickOnToggler && !isClickInsideMenu && navbarCollapse.classList.contains('show')) {
        navbarCollapse.classList.remove('show');
        navbarToggler.classList.remove('active');
        navbarToggler.classList.add('collapsed');
        navbarToggler.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
