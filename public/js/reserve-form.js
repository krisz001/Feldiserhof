// Formspree – egyszerű foglalás visszajelzés
(() => {
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xblzjyqr';
  const reserveForm = document.getElementById('reserveForm');
  if (!reserveForm) return;

  reserveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = reserveForm.checkValidity();
    reserveForm.classList.add('was-validated');
    if (!ok) return;

    const fd = new FormData(reserveForm);
    const emailField = document.getElementById('email');
    if (emailField) fd.set('_replyto', emailField.value);

    const btn = reserveForm.querySelector('button[type="submit"]');
    const btnText = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Küldés…'; }

    try {
      const r = await fetch(FORMSPREE_ENDPOINT, { method:'POST', body:fd, headers:{ 'Accept':'application/json' } });
      const text = await r.text();
      if (r.ok) {
        document.getElementById('reserveSuccess')?.classList.remove('d-none');
        document.getElementById('reserveError')?.classList.add('d-none');
        reserveForm.reset();
        reserveForm.classList.remove('was-validated');
      } else {
        let msg = 'Sikertelen küldés. Próbálja újra később.';
        try {
          const data = JSON.parse(text);
          if (data?.errors?.length) msg = data.errors.map(e => e.message).join(' | ');
        } catch {}
        const err = document.getElementById('reserveError');
        if (err) {
          err.textContent = msg.includes('Form not found')
            ? 'Form nem található: ellenőrizd az endpointot a Formspree-ben.'
            : msg;
          err.classList.remove('d-none');
        }
      }
    } catch (e2) {
      console.error('Network error:', e2);
      document.getElementById('reserveError')?.classList.remove('d-none');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btnText; }
    }
  });
})();
