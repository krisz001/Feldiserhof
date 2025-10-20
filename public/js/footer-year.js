// Év a láblécben
(() => {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
})();
