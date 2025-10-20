// Dinamikus könyv: kategória-gombok → goto
(() => {
  const byId = (id) => document.getElementById(id);
  const hook = (el, key) => el && el.addEventListener('click', () => {
    if (typeof window.__flipbookGoto === 'function') {
      window.__flipbookGoto(key);
    } else {
      document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  hook(byId('gotoStarters'), 'starters');
  hook(byId('gotoMains'),    'mains');
  hook(byId('gotoDesserts'), 'desserts');
})();
