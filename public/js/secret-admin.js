(() => {
  const root = document.getElementById('admCreative');
  if (!root) return;

  const stage = root.querySelector('.adm-creative__stage');
  const form = root.querySelector('#adminLoginForm');
  const passEl = root.querySelector('#adm-pass');
  const submitBtn = root.querySelector('.admin-submit-btn');

  // CSRF token változó
  let csrfToken = '';

  // CSRF token lekérése
  const fetchCsrfToken = async () => {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      csrfToken = data.token;
    } catch (error) {
      console.error('CSRF token lekérési hiba:', error);
    }
  };

  // CSRF token betöltése az oldal betöltésekor
  document.addEventListener('DOMContentLoaded', fetchCsrfToken);

  // --- Open / Close ---
  const open = () => {
    if (root.classList.contains('is-open')) return;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // CSRF token frissítése minden megnyitáskor
    fetchCsrfToken();
    setTimeout(() => passEl?.focus(), 50);
  };

  const close = () => {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    form?.reset();
    if (submitBtn) {
      submitBtn.classList.remove('loading');
    }
  };

  // ESC és backdrop/záró gomb
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-open')) close();
  });

  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof Element && t.hasAttribute('data-close')) close();
  });

  // --- TITKOS TRIGGEREK ---
  // 1) Felhasználó begépeli: "FELDIS" (max 10s)
  let buffer = '',
    lastTs = 0;
  const SECRET = 'FELDIS';

  document.addEventListener('keydown', (e) => {
    const now = Date.now();
    if (now - lastTs > 10000) buffer = '';
    lastTs = now;

    const ch = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (ch) {
      buffer += ch;
      if (buffer.endsWith(SECRET)) {
        buffer = '';
        open();
      }
    }
  });

  // 2) Alt + Shift + A
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'a' && e.altKey && e.shiftKey) {
      e.preventDefault();
      open();
    }
  });

  // 3) Hosszan nyomott 'A' (>= 2000 ms)
  let aDownAt = 0;

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'a' && !aDownAt) {
      aDownAt = Date.now();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'a') {
      if (aDownAt && Date.now() - aDownAt >= 2000) {
        open();
      }
      aDownAt = 0;
    }
  });

  // --- Submit kezelése ---
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pwd = (passEl?.value || '').trim();
    if (!pwd) {
      showMessage('Kérjük, adja meg a jelszót.', 'error');
      return;
    }

    // Betöltő állapot beállítása
    if (submitBtn) {
      submitBtn.classList.add('loading');
    }

    try {
      // Valódi fetch hívás a szerver felé
      const response = await fetch('/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ password: pwd }),
      });

      const result = await response.json();

      if (submitBtn) {
        submitBtn.classList.remove('loading');
      }

      if (response.ok && result.ok) {
        // Sikeres bejelentkezés - átirányítás az admin felületre
        showMessage('Sikeres bejelentkezés! Átirányítás...', 'success');
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1000);
      } else {
        // Hibás jelszó
        showMessage(result.msg || 'Hibás jelszó!', 'error');
        passEl.value = '';
        passEl.focus();
      }
    } catch (error) {
      console.error('Bejelentkezési hiba:', error);
      if (submitBtn) {
        submitBtn.classList.remove('loading');
      }
      showMessage('Hiba történt a bejelentkezés során. Kérjük, próbálja újra.', 'error');
    }
  });

  // Üzenet megjelenítése
  function showMessage(message, type) {
    // Eltávolítjuk a korábbi üzeneteket
    const existingMessages = root.querySelectorAll('.admin-message');
    existingMessages.forEach((msg) => msg.remove());

    // Új üzenet létrehozása
    const messageEl = document.createElement('div');
    messageEl.className = `admin-message admin-message--${type}`;
    messageEl.textContent = message;

    // Stílus beállítása
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
      ${type === 'success' ? 'background: #10b981;' : 'background: #ef4444;'}
    `;

    document.body.appendChild(messageEl);

    // Üzenet eltűntetése 3 másodperc után
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
          }
        }, 300);
      }
    }, 3000);
  }

  // CSS animációk hozzáadása
  if (!document.querySelector('#admin-message-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-message-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // --- Fókuszcsapda, amíg nyitva van ---
  stage?.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !root.classList.contains('is-open')) return;

    const focusables = stage.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const list = Array.from(focusables).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
    );

    if (!list.length) return;

    const first = list[0];
    const last = list[list.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  });
})();
