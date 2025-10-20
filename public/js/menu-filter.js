// Menü-szűrés rácshoz (#menuGrid)
(() => {
  const filterBtns = document.querySelectorAll('[data-filter]');
  const menuItems  = document.querySelectorAll('#menuGrid .menu-item');
  if (!filterBtns.length || !menuItems.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.getAttribute('data-filter');

      menuItems.forEach(item => {
        const match = (cat === 'all') || (item.getAttribute('data-cat') === cat);
        item.classList.toggle('d-none', !match);
      });
    });
  });
})();
