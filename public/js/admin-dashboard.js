document.getElementById('logoutForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await fetch('/admin/logout', { method: 'POST', credentials: 'same-origin' });
  if (r.ok) location.href = '/';
});
