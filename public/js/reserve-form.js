/* eslint-env browser */
/* global FormData, fetch */
'use strict';

(() => {
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xblzjyqr';

  var form = document.getElementById('reservationForm');
  if (!form) return;

  var alertBox = document.getElementById('resAlert');
  var submitBtn = document.getElementById('resSubmit');
  var emailInput = document.getElementById('resEmail');
  var dateInput = document.getElementById('resDate');
  var timeInput = document.getElementById('resTime');

  // --- Helyi idő szerinti min-dátum (YYYY-MM-DD) ---
  function formatLocalDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }
  if (dateInput) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    dateInput.min = formatLocalDate(today);
  }

  // --- Gäste számláló ---
  var gHidden = document.getElementById('guests');
  var gNum = document.getElementById('gNum');
  var gDec = document.getElementById('gDec');
  var gInc = document.getElementById('gInc');

  function clampGuests(v) {
    return Math.max(1, Math.min(12, v));
  }
  function toInt(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }
  function setGuests(v) {
    var x = clampGuests(toInt(v) || 1);
    if (gHidden) gHidden.value = String(x);
    if (gNum) gNum.textContent = String(x);
    if (gDec) gDec.disabled = x <= 1;
    if (gInc) gInc.disabled = x >= 12;
  }
  setGuests(gHidden && gHidden.value ? gHidden.value : '2');
  if (gDec) gDec.addEventListener('click', () => setGuests(toInt(gHidden.value) - 1));
  if (gInc) gInc.addEventListener('click', () => setGuests(toInt(gHidden.value) + 1));

  // --- Floating label sync (wrap + input .has-value) ---
  (function syncFloating() {
    var inputs = form.querySelectorAll(
      '.form-floating input, .form-floating select, .form-floating textarea',
    );

    function apply(el) {
      var has = !!(el && String(el.value).trim());
      var wrap = el.closest('.form-floating');
      if (wrap) wrap.classList.toggle('has-value', has);
      el.classList.toggle('has-value', has);
    }
    function wire(el) {
      ['input', 'change', 'blur'].forEach((ev) => el.addEventListener(ev, () => apply(el)));
      apply(el); // azonnal
      setTimeout(() => apply(el), 100); // autofill késleltetve
      setTimeout(() => apply(el), 500);
    }
    inputs.forEach(wire);

    // Visszalépés BFCache-ből
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) inputs.forEach(apply);
    });

    // Reset után tisztítás
    form.addEventListener('reset', () =>
      setTimeout(() => {
        inputs.forEach((el) => {
          var wrap = el.closest('.form-floating');
          if (wrap) wrap.classList.remove('has-value');
          el.classList.remove('has-value');
        });
        setGuests(2);
      }, 0),
    );
  })();

  function showAlert(type, msg) {
    if (!alertBox) return;
    alertBox.className = 'alert alert-' + type;
    alertBox.setAttribute('role', 'alert');
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
    try {
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}
  }

  // --- Submit ---
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // honeypot
    var honey = form.querySelector('input[name="company"]');
    if (honey && honey.value) return;

    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    var btnText = submitBtn && submitBtn.querySelector('.btn-text');
    var btnLoad = submitBtn && submitBtn.querySelector('.btn-loading');
    var origTxt = submitBtn ? submitBtn.textContent : null;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      if (btnText && btnLoad) {
        btnText.classList.add('d-none');
        btnLoad.classList.remove('d-none');
      } else submitBtn.textContent = 'Senden…';
    }
    if (alertBox) alertBox.classList.add('d-none');

    var fd = new FormData(form);
    if (emailInput && emailInput.value) fd.set('_replyto', emailInput.value);
    fd.set('_subject', 'Neue Reservierungsanfrage – Feldiserhof');

    fetch(FORMSPREE_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then((res) =>
        res.text().then((raw) => {
          let payload = null;
          try {
            payload = JSON.parse(raw);
          } catch (e) {}
          if (res.ok) {
            showAlert('success', 'Vielen Dank! Wir haben Ihre Anfrage erhalten.');
            form.reset();
            form.classList.remove('was-validated');
            setGuests(2);
          } else {
            let msg = 'Leider ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.';
            if (payload && Array.isArray(payload.errors) && payload.errors.length) {
              msg = payload.errors.map((er) => er.message).join(' | ');
            } else if (/Form not found/i.test(raw)) {
              msg =
                'Formular-Endpunkt nicht gefunden. Bitte prüfen Sie die Formspree-Einstellungen.';
            }
            showAlert('danger', msg);
          }
        }),
      )
      .catch((err) => {
        console.error('Network error:', err);
        showAlert('danger', 'Netzwerkfehler. Bitte versuchen Sie es später erneut.');
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute('aria-busy');
          if (btnText && btnLoad) {
            btnText.classList.remove('d-none');
            btnLoad.classList.add('d-none');
          } else submitBtn.textContent = origTxt || 'Anfrage senden';
        }
      });
  });
})();
