// Navbar auto-hide (finom)
(() => {
  const nav = document.querySelector('.navbar.sticky-top');
  if (!nav) return;
  let lastY = window.scrollY,
    hidden = false;

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const down = y > lastY;
      lastY = y;
      if (down && y > 120 && !hidden) {
        hidden = true;
        nav.style.transition = 'transform .25s ease';
        nav.style.transform = 'translateY(-100%)';
      } else if (!down && hidden) {
        hidden = false;
        nav.style.transform = 'translateY(0)';
      }
    },
    { passive: true },
  );
})();
