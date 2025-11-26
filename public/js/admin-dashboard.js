// public/js/admin-dashboard.js

const $ = (sel) => document.querySelector(sel);

// =============== CSRF TOKEN KEZELÉS ===============

async function initCsrfToken() {
  try {
    const resp = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) throw new Error('CSRF fetch failed: ' + resp.status);
    const data = await resp.json();
    csrfToken = data.token || '';

    // Rejtett _csrf mezők kitöltése
    document.querySelectorAll('input[name="_csrf"]').forEach(i => {
      i.value = csrfToken;
    });
  } catch (err) {
    console.error('❌ CSRF token lekérési hiba:', err);
  }
}
async function getCsrfToken() {
  if (!csrfToken) await initCsrfToken();
  return csrfToken;
}
initCsrfToken().catch(() => {});

// =============== LOGOUT FORM ===============
document.addEventListener('DOMContentLoaded', () => {
  const logoutForm = document.getElementById('logoutForm');
  if (logoutForm) {
    logoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const token = await getCsrfToken();
        const body = `_csrf=${encodeURIComponent(token)}`;
        const r = await fetch('/admin/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'CSRF-Token': token
          },
          body
        });
        if (r.ok) {
          window.location.href = '/';
        } else {
          // fallback normál submit
          logoutForm.submit();
        }
      } catch (err) {
        console.error('Logout hiba, fallback normál submit:', err);
        logoutForm.submit();
      }
    });
  }
});

// =============== FEATURE FLAG BADGE ===============
document.addEventListener('DOMContentLoaded', async () => {
  const badge = document.getElementById('flagBadge');
  if (!badge) return;
  try {
    const r = await fetch('/api/feature-flags', { credentials: 'same-origin' });
    if (!r.ok) return;
    const j = await r.json();
    const on = !!j.menuBookEnabled;
    badge.textContent = on ? 'Könyv nyitása: engedélyezve' : 'Könyv nyitása: tiltva';
    badge.classList.toggle('bg-success', on);
    badge.classList.toggle('bg-secondary', !on);
  } catch (err) {
    console.warn('Feature flag lekérési hiba:', err);
  }
});

// =============== HERO BOX KEZELÉS ===============

let currentHeroBoxData = {};
let heroBoxQuill = null;
let heroBoxSaving = false; // LOCK: csak egyszerre egy mentés

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updatePreview() {
  const iconEl   = document.getElementById('previewIcon');
  const titleEl  = document.getElementById('previewTitle');
  const descEl   = document.getElementById('previewDescription');
  const btnEl    = document.getElementById('previewButton');
  const datesEl  = document.getElementById('previewDates');
  const cardEl   = document.getElementById('heroBoxPreview');

  const icon      = document.getElementById('heroBoxIcon')?.value || '🏔️';
  const title     = document.getElementById('heroBoxTitle')?.value || 'Aktuelles Angebot';
  const highlight = document.getElementById('heroBoxHighlightText')?.value || '';
  const btnText   = document.getElementById('heroBoxButtonText')?.value || 'Mehr erfahren';
  const endDate   = document.getElementById('heroBoxEndDate')?.value || '';
  const bottom    = document.getElementById('heroBoxBottomLabel')?.value || '';
  const style     = document.getElementById('heroBoxStyle')?.value || 'glass';
  const theme     = document.getElementById('heroBoxTheme')?.value || 'gold';
  const align     = document.getElementById('heroBoxAlign')?.value || 'center';

  if (iconEl)  iconEl.textContent  = icon;
  if (titleEl) titleEl.textContent = title;

  if (descEl) {
    let baseHtml = '';
    const hiddenDescEl = document.getElementById('heroBoxDescription');
    // Quill-ből vagy hidden inputból
    if (heroBoxQuill) {
      baseHtml = heroBoxQuill.root.innerHTML;
    } else if (hiddenDescEl && hiddenDescEl.value) {
      baseHtml = hiddenDescEl.value;
    } else {
      baseHtml = '<p>Genießen Sie unseren speziellen Bergblick mit 3-Gänge-Menü</p>';
    }
    // Kiemelt sorok
    let highlightsHtml = '';
    if (highlight.trim()) {
      const lines = highlight.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        highlightsHtml =
          '<br>' +
          lines.map(line => '<br>' + escapeHtml(line)).join('');
      }
    }
    descEl.innerHTML = baseHtml + highlightsHtml;
  }

  if (btnEl) btnEl.textContent = btnText;

  if (datesEl) {
    if (bottom.trim()) {
      datesEl.textContent = bottom;
    } else if (endDate) {
      datesEl.textContent = `Gültig bis: ${new Date(endDate).toLocaleDateString('de-DE')}`;
    } else {
      datesEl.textContent = 'Gültig bis: 25.11.2025';
    }
  }

  if (cardEl) {
    const styleClasses = ['hero-preview-style-glass', 'hero-preview-style-simple', 'hero-preview-style-bordered'];
    const themeClasses = ['hero-preview-theme-gold', 'hero-preview-theme-green', 'hero-preview-theme-blue'];
    const alignClasses = ['hero-preview-align-center', 'hero-preview-align-left'];
    cardEl.classList.remove(...styleClasses, ...themeClasses, ...alignClasses);
    cardEl.classList.add(
      `hero-preview-style-${style}`,
      `hero-preview-theme-${theme}`,
      `hero-preview-align-${align}`
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const previewFields = [
    'heroBoxIcon',
    'heroBoxTitle',
    'heroBoxHighlightText',
    'heroBoxBottomLabel',
    'heroBoxButtonText',
    'heroBoxEndDate'
  ];
  previewFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });
  ['heroBoxStyle', 'heroBoxTheme', 'heroBoxAlign'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updatePreview);
  });
  // Quill init
  const quillContainer = document.getElementById('heroBoxDescriptionEditor');
  if (quillContainer && window.Quill) {
    heroBoxQuill = new Quill('#heroBoxDescriptionEditor', {
      theme: 'snow',
      placeholder: 'Genießen Sie unseren speziellen Bergblick mit 3-Gänge-Menü',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean']
        ]
      }
    });
    heroBoxQuill.on('text-change', () => {
      const hiddenDescEl = document.getElementById('heroBoxDescription');
      if (hiddenDescEl) hiddenDescEl.value = heroBoxQuill.root.innerHTML;
      updatePreview();
    });
  }
  // accessibility: modal focus amikor megnyílik
  const modalEl = document.getElementById('heroBoxModal');
  if (modalEl) {
    modalEl.addEventListener('shown.bs.modal', () => {
      const firstInput = modalEl.querySelector('input, textarea, select');
      if (firstInput) firstInput.focus();
    });
  }
});

// Hero Box editor megnyitása
async function openHeroBoxEditor() {
  try {
    // Form reset először, hogy üresről is indulhasson
    currentHeroBoxData = {};
    [
      'heroBoxEnabled','heroBoxIcon','heroBoxTitle','heroBoxDescription',
      'heroBoxHighlightText','heroBoxBottomLabel','heroBoxButtonText','heroBoxButtonLink',
      'heroBoxStartDate','heroBoxEndDate','heroBoxPriority','heroBoxTargetAudience',
      'heroBoxStyle','heroBoxTheme','heroBoxAlign','heroBoxIsActive'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') el.checked = false;
        else if (el.tagName === 'SELECT') el.value = el.options[0]?.value || '';
        else el.value = '';
      }
    });

    // szerverről betöltés
    const response = await fetch('/admin/api/hero-box', {
      credentials: 'same-origin',
      headers: { 'CSRF-Token': await getCsrfToken() }
    });
    if (!response.ok) throw new Error('Failed to load hero box data');
    currentHeroBoxData = await response.json();

    const enabledEl    = document.getElementById('heroBoxEnabled');
    const iconEl       = document.getElementById('heroBoxIcon');
    const titleEl      = document.getElementById('heroBoxTitle');
    const hiddenDescEl = document.getElementById('heroBoxDescription');
    const highlightEl  = document.getElementById('heroBoxHighlightText');
    const bottomEl     = document.getElementById('heroBoxBottomLabel');
    const btnTextEl    = document.getElementById('heroBoxButtonText');
    const btnLinkEl    = document.getElementById('heroBoxButtonLink');
    const startDateEl  = document.getElementById('heroBoxStartDate');
    const endDateEl    = document.getElementById('heroBoxEndDate');
    const priorityEl   = document.getElementById('heroBoxPriority');
    const targetEl     = document.getElementById('heroBoxTargetAudience');
    const styleEl      = document.getElementById('heroBoxStyle');
    const themeEl      = document.getElementById('heroBoxTheme');
    const alignEl      = document.getElementById('heroBoxAlign');
    const activeEl     = document.getElementById('heroBoxIsActive');

    if (enabledEl)   enabledEl.checked = currentHeroBoxData.enabled || false;
    if (iconEl)      iconEl.value      = currentHeroBoxData.icon || '';
    if (titleEl)     titleEl.value     = currentHeroBoxData.title || '';
    const descriptionHtmlFromServer = currentHeroBoxData.description || '';
    if (heroBoxQuill) {
      heroBoxQuill.root.innerHTML = descriptionHtmlFromServer || '';
    }
    if (hiddenDescEl) {
      hiddenDescEl.value = descriptionHtmlFromServer || '';
    }
    if (highlightEl) highlightEl.value = currentHeroBoxData.highlightText || '';
    if (bottomEl)    bottomEl.value    = currentHeroBoxData.bottomLabel || '';
    if (btnTextEl)   btnTextEl.value   = currentHeroBoxData.buttonText || '';
    if (btnLinkEl)   btnLinkEl.value   = currentHeroBoxData.buttonLink || '';
    if (startDateEl) startDateEl.value = currentHeroBoxData.startDate || '';
    if (endDateEl)   endDateEl.value   = currentHeroBoxData.endDate || '';
    if (priorityEl)  priorityEl.value  = currentHeroBoxData.priority || 1;
    if (targetEl)    targetEl.value    = currentHeroBoxData.targetAudience || 'all';
    if (styleEl)     styleEl.value     = currentHeroBoxData.style || 'glass';
    if (themeEl)     themeEl.value     = currentHeroBoxData.theme || 'gold';
    if (alignEl)     alignEl.value     = currentHeroBoxData.align || 'center';
    if (activeEl)    activeEl.checked  = currentHeroBoxData.isActive !== false;

    updatePreview();

    const modalEl = document.getElementById('heroBoxModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  } catch (e) {
    console.error('Hiba a hero box betöltésekor:', e);
    alert('Hiba a hero box adatok betöltésekor.');
  }
}

// Hero Box mentése
async function saveHeroBox() {
  try {
    if (heroBoxSaving) return; // védelem: egyszerre csak 1 mentés
    heroBoxSaving = true;
    const saveBtn = document.querySelector('#heroBoxModal .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Mentés folyamatban..."; }

    if (heroBoxQuill) {
      const hiddenDescEl = document.getElementById('heroBoxDescription');
      if (hiddenDescEl) {
        hiddenDescEl.value = heroBoxQuill.root.innerHTML;
      }
    }

    const formData = {
      enabled:        document.getElementById('heroBoxEnabled')?.checked || false,
      icon:           document.getElementById('heroBoxIcon')?.value || '',
      title:          document.getElementById('heroBoxTitle')?.value || '',
      description:    document.getElementById('heroBoxDescription')?.value || '',
      highlightText:  document.getElementById('heroBoxHighlightText')?.value || '',
      bottomLabel:    document.getElementById('heroBoxBottomLabel')?.value || '',
      buttonText:     document.getElementById('heroBoxButtonText')?.value || '',
      buttonLink:     document.getElementById('heroBoxButtonLink')?.value || '',
      startDate:      document.getElementById('heroBoxStartDate')?.value || '',
      endDate:        document.getElementById('heroBoxEndDate')?.value || '',
      priority:       parseInt(document.getElementById('heroBoxPriority')?.value, 10) || 1,
      targetAudience: document.getElementById('heroBoxTargetAudience')?.value || 'all',
      style:          document.getElementById('heroBoxStyle')?.value || 'glass',
      theme:          document.getElementById('heroBoxTheme')?.value || 'gold',
      align:          document.getElementById('heroBoxAlign')?.value || 'center',
      isActive:       document.getElementById('heroBoxIsActive')?.checked !== false
    };

    if (!formData.title.trim()) throw new Error('A cím megadása kötelező!');
    if (!formData.description.trim()) throw new Error('A leírás megadása kötelező!');

    const response = await fetch('/admin/api/hero-box', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': await getCsrfToken()
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) throw new Error('Failed to save hero box data');
    const result = await response.json();
    if (result.ok) {
      const modalEl = document.getElementById('heroBoxModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      alert('Hero Box sikeresen mentve!');
    } else {
      alert('Hiba a mentés során: ' + (result.msg || 'Ismeretlen hiba'));
    }
  } catch (e) {
    console.error('Hiba a hero box mentésekor:', e);
    alert(`Hiba a hero box mentésekor: ${e.message || e}`);
  } finally {
    heroBoxSaving = false;
    const saveBtn = document.querySelector('#heroBoxModal .btn-primary');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Mentés"; }
  }
}

// Globálissá tesszük, hogy az onclick működjön az EJS-ben
window.openHeroBoxEditor = openHeroBoxEditor;
window.saveHeroBox = saveHeroBox;
