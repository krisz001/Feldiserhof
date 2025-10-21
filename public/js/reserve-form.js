/* eslint-env browser */
/* global FormData, fetch */
'use strict';

(() => {
  // --- Config ---
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xblzjyqr'; // <- ha más, írd át

  // --- DOM refs ---
  var form       = document.getElementById('reservationForm');
  if (!form) return;

  var alertBox   = document.getElementById('resAlert');
  var submitBtn  = document.getElementById('resSubmit');
  var emailInput = document.getElementById('resEmail');
  var dateInput  = document.getElementById('resDate');
  var timeInput  = document.getElementById('resTime');

  // --- Min dátum: ma ---
  if (dateInput) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    dateInput.min = today.toISOString().slice(0, 10);
  }

  // --- JAVÍTOTT Floating label sync (minden mezőre) ---
  (function syncFloating() {
    function updateWrap(el) {
      var wrap = el && el.closest ? el.closest('.form-floating') : null;
      if (!wrap) return;
      
      // Minden mezőtípus kezelése
      if (el.type === 'date' || el.type === 'time') {
        // Dátum/idő mezők
        if (el.value) {
          wrap.classList.add('has-value');
        } else {
          wrap.classList.remove('has-value');
        }
      } else if (el.type === 'email' || el.type === 'text' || el.type === 'tel') {
        // Szöveges mezők
        if (el.value && String(el.value).trim() !== '') {
          wrap.classList.add('has-value');
        } else {
          wrap.classList.remove('has-value');
        }
      } else if (el.tagName === 'SELECT') {
        // Select mezők
        if (el.value && el.value !== '') {
          wrap.classList.add('has-value');
        } else {
          wrap.classList.remove('has-value');
        }
      } else if (el.tagName === 'TEXTAREA') {
        // Textarea
        if (el.value && String(el.value).trim() !== '') {
          wrap.classList.add('has-value');
        } else {
          wrap.classList.remove('has-value');
        }
      }
    }
    
    // Összes floating mező kezelése
    var floatingInputs = form.querySelectorAll('.form-floating input, .form-floating select, .form-floating textarea');
    floatingInputs.forEach(function (el) {
      if (!el) return;
      
      // Inicializálás
      updateWrap(el);
      
      // Eseményfigyelők
      el.addEventListener('change', function(){ updateWrap(el); });
      el.addEventListener('input',  function(){ updateWrap(el); });
      el.addEventListener('blur',   function(){ updateWrap(el); });
      
      // Autofill kezelése
      el.addEventListener('animationstart', function(e) {
        if (e.animationName === 'autoFillStart') {
          setTimeout(function() { updateWrap(el); }, 100);
        }
      });
    });
    
    // Oldal betöltése után ellenőrzés (autofill miatt)
    setTimeout(function() {
      floatingInputs.forEach(function(el) {
        updateWrap(el);
      });
    }, 500);
  })();

  // --- Gäste számláló ---
  var gHidden = document.getElementById('guests');
  var gNum    = document.getElementById('gNum');
  var gDec    = document.getElementById('gDec');
  var gInc    = document.getElementById('gInc');

  function clampGuests(v){ return Math.max(1, Math.min(12, v)); }
  function toInt(v){ var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  function setGuests(v){
    var x = clampGuests(toInt(v) || 1);
    if (gHidden) gHidden.value = String(x);
    if (gNum)    gNum.textContent = String(x);
    if (gDec)    gDec.disabled = x <= 1;
    if (gInc)    gInc.disabled = x >= 12;
  }

  // init + gombok
  setGuests((gHidden && gHidden.value) ? gHidden.value : '2');
  if (gDec) gDec.addEventListener('click', function(){ setGuests(toInt(gHidden.value) - 1); });
  if (gInc) gInc.addEventListener('click', function(){ setGuests(toInt(gHidden.value) + 1); });

  // --- Helper: alert megjelenítés ---
  function showAlert(type, msg) {
    if (!alertBox) return;
    alertBox.className = 'alert alert-' + type;
    alertBox.setAttribute('role','alert');
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
    try { alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  // --- Form reset handler (floating label újraszinkronizáláshoz) ---
  function handleFormReset() {
    // Várakozás a reset befejezésére
    setTimeout(function() {
      var floatingInputs = form.querySelectorAll('.form-floating input, .form-floating select, .form-floating textarea');
      floatingInputs.forEach(function(el) {
        var wrap = el.closest('.form-floating');
        if (wrap) {
          wrap.classList.remove('has-value');
        }
      });
      
      // Gäste számláló reset
      setGuests(2);
    }, 10);
  }

  // Form reset esemény figyelése
  form.addEventListener('reset', handleFormReset);

  // --- Submit handler ---
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Honeypot (spam)
    var honey = form.querySelector('input[name="company"]');
    if (honey && honey.value) return;

    // Bootstrap kliensvalidáció
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    var originalText = submitBtn ? submitBtn.textContent : null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy','true');
      submitBtn.textContent = 'Senden…';
    }
    if (alertBox) alertBox.classList.add('d-none');

    // FormData (ne állíts kézzel Content-Type-ot!)
    var fd = new FormData(form);
    if (emailInput && emailInput.value) fd.set('_replyto', emailInput.value);
    fd.set('_subject', 'Neue Reservierungsanfrage – Feldiserhof');

    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      body: fd,
      headers: { Accept: 'application/json' }
    })
    .then(function (res) {
      return res.text().then(function (raw) {
        var payload = null;
        try { payload = JSON.parse(raw); } catch (e) {}
        if (res.ok) {
          showAlert('success', 'Vielen Dank! Wir haben Ihre Anfrage erhalten.');
          form.reset();
          form.classList.remove('was-validated');
          
          // Floating label újraszinkronizálás reset után
          setTimeout(function() {
            var floatingInputs = form.querySelectorAll('.form-floating input, .form-floating select, .form-floating textarea');
            floatingInputs.forEach(function(el) {
              var wrap = el.closest('.form-floating');
              if (wrap) wrap.classList.remove('has-value');
            });
          }, 50);
          
        } else {
          var msg = 'Leider ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.';
          if (payload && Array.isArray(payload.errors) && payload.errors.length) {
            msg = payload.errors.map(function (er) { return er.message; }).join(' | ');
          } else if (/Form not found/i.test(raw)) {
            msg = 'Formular-Endpunkt nicht gefunden. Bitte prüfen Sie die Formspree-Einstellungen.';
          }
          showAlert('danger', msg);
        }
      });
    })
    .catch(function (err) {
      console.error('Network error:', err);
      showAlert('danger', 'Netzwerkfehler. Bitte versuchen Sie es später erneut.');
    })
    .finally(function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.textContent = originalText;
      }
    });
  });

  // --- Oldal betöltése utáni inicializálás ---
  document.addEventListener('DOMContentLoaded', function() {
    // Floating label állapot ellenőrzése oldal betöltésekor
    setTimeout(function() {
      var floatingInputs = form.querySelectorAll('.form-floating input, .form-floating select, .form-floating textarea');
      floatingInputs.forEach(function(el) {
        var wrap = el.closest('.form-floating');
        if (wrap && el.value) {
          wrap.classList.add('has-value');
        }
      });
    }, 100);
  });
})();