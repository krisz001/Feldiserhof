document.addEventListener('DOMContentLoaded', () => {
  // Hover csak egérrel (ne mobilon)
  const noHover = window.matchMedia && matchMedia('(hover: none)').matches;
  if (!noHover) {
    document.querySelectorAll('.price-card').forEach((card) => {
      card.addEventListener('mouseenter', () => card.classList.add('is-hover'));
      card.addEventListener('mouseleave', () => card.classList.remove('is-hover'));
    });
  }

  // Hibás galéria-kép -> semleges placeholder
  document.querySelectorAll('.gallery-img').forEach((img) => {
    img.addEventListener('error', () => {
      const ph = document.createElement('div');
      ph.className = 'gallery-item small'; // kap dobozt, ha önállóan rakod be
      ph.style.display = 'flex';
      ph.style.alignItems = 'center';
      ph.style.justifyContent = 'center';
      ph.style.background = 'linear-gradient(135deg,#eef2f6,#f7fafc)';
      ph.style.color = '#8aa0b2';
      ph.style.borderRadius = '16px';
      ph.style.height = img.closest('.gallery-item')?.classList.contains('large')
        ? '280px'
        : '200px';
      ph.textContent = 'Bild nicht verfügbar';
      const wrapper = img.closest('.gallery-item') || img.parentElement;
      wrapper.replaceWith(ph);
    });
  });
});
