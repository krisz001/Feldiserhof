// public/js/about.js
(() => {
  const section = document.getElementById('about');
  if (!section) return;

  // Respect user preference: disable motion
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    section.classList.add('in'); // show immediately, no animation
    return;
  }

  if (!('IntersectionObserver' in window)) {
    section.classList.add('in'); // graceful fallback
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.18 },
  );

  io.observe(section);
})();
