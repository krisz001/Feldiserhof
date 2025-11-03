(() => {
  const shell = document.querySelector('.map-shell');
  const frameHost = document.getElementById('map-frame');
  if (!shell || !frameHost) return;

  const load = () => {
    if (frameHost.dataset.loaded) return;
    frameHost.dataset.loaded = '1';
    frameHost.classList.remove('d-none');
    frameHost.innerHTML = `
      <div class="ratio ratio-4x3 rounded shadow-sm overflow-hidden">
        <iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade"
          src="https://www.google.com/maps?q=Feldiserhof,+Feldis,+Schweiz&output=embed"
          allowfullscreen></iframe>
      </div>`;
    shell.querySelector('.map-load-btn')?.classList.add('d-none');
    shell.querySelector('.map-placeholder')?.classList.add('loaded');
  };

  shell.querySelector('.map-load-btn')?.addEventListener('click', load);
  new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (e.isIntersecting) {
          load();
        }
      }),
    { rootMargin: '200px 0' },
  ).observe(shell);
})();
