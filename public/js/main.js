// ===========================================================
// Év a láblécben
// ===========================================================
(() => {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
})();

// ===========================================================
// (Opcionális) Menü-szűrés rácshoz – ha nincs #menuGrid, csendben kilép
// ===========================================================
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

// ===========================================================
// Dinamikus könyv: kategória-gombok → ugorjanak a megfelelő oldalra
// (menu.js tegye ki: window.__flipbookGoto('starters'|'mains'|'desserts'))
// ===========================================================
(() => {
  const byId = (id) => document.getElementById(id);
  const hook = (el, key) => el && el.addEventListener('click', () => {
    if (typeof window.__flipbookGoto === 'function') {
      window.__flipbookGoto(key);
    } else {
      // ha még nincs kész a flipbook, guruljunk a menühöz
      const sec = document.getElementById('menu');
      sec && sec.scrollIntoView({ behavior: 'smooth' });
    }
  });

  hook(byId('gotoStarters'), 'starters');
  hook(byId('gotoMains'),    'mains');
  hook(byId('gotoDesserts'), 'desserts');
})();

// ===========================================================
// Formspree – egyszerű foglalás visszajelzés
// ===========================================================
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

// ===========================================================
// Öffnungszeiten – Europe/Zurich, next open, kivételek, overrides
// - opening-hours.json-ból tölt; ha nincs, fallback
// - HTML: #badgeOpen, #badgeClosed, #statusText, #hoursTable tbody
// ===========================================================
(() => {
  // FONTOS: a fájl nálad a gyökérben van, ne /js alatt:
  const CONFIG_URL = 'js/opening-hours.json';
  const FALLBACK = {
    timezone: 'Europe/Zurich',
    locale: 'de-CH',
    week: {
      "0": [["09:00","21:00"]], "1": [], "2": [],
      "3": [["09:00","21:00"]], "4": [["09:00","21:00"]],
      "5": [["09:00","21:00"]], "6": [["09:00","21:00"]]
    },
    exceptions: [],
    overrides: [],
    labels: {
      days: ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"],
      openBadge: "GEÖFFNET",
      closedBadge: "GESCHLOSSEN",
      todayOpen: "Heute geöffnet – bis {time} Uhr",
      closedUntil: "Geschlossen – bis einschließlich {date}",
      closedOpens: "Geschlossen – öffnet {dayText} um {time} Uhr",
      timezone: "Zeitzone: Europe/Zurich"
    }
  };

  // ---- Util ----
  function dfParts(locale, tz, date) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(date).reduce((a,p) => (a[p.type]=p.value, a), {});
  }
  function nowInTZ(locale, tz) {
    const d = new Date();
    const p = dfParts(locale, tz, d);
    const wd2 = p.weekday.toLowerCase().slice(0,2);
    const map = { so:0, mo:1, di:2, mi:3, do:4, fr:5, sa:6 };
    const H = parseInt(p.hour,10), M = parseInt(p.minute,10), S = parseInt(p.second,10);
    return { date: d, day: map[wd2], minutes: H*60+M, seconds: S, y:+p.year, m:+p.month, dd:+p.day, rawParts:p };
  }
  const pad2 = (n)=> String(n).padStart(2,'0');
  const toMin = (hhmm)=> { const [h,m]=hhmm.split(':').map(Number); return h*60+m; };
  const toHHMM = (min)=> `${pad2(Math.floor(min/60))}:${pad2(min%60)}`;
  const dateFromYMD = (y,m,d)=> new Date(Date.UTC(y, m-1, d));
  const addDaysUTC  = (y,m,d,add)=> new Date(Date.UTC(y, m-1, d + add));
  const ymd = (locale,tz,date)=> { const p=dfParts(locale,tz,date); return `${p.year}-${p.month}-${p.day}`; };
  const shortDE = (locale,tz,date)=> { const p=dfParts(locale,tz,date); return `${p.day}.${p.month}.`; };

  function normalizeRanges(ranges) {
    const out=[];
    (ranges||[]).forEach(([a,b])=>{
      const s=toMin(a), e=toMin(b);
      if (s<e) out.push([s,e]);
      else if (s>e) out.push([s, 24*60]); // átcsorgó sáv: ma éjfélig
    });
    return out.sort((x,y)=>x[0]-y[0]);
  }

  function getOriginalRangesForDateRaw(cfg, date){
    const { locale, timezone, week, exceptions, overrides } = cfg;
    const key = ymd(locale, timezone, date);
    const ov = (overrides||[]).find(o => o.date === key);
    if (ov) return ov.open || [];
    const ex = (exceptions||[]).find(e => key >= e.start && key <= e.end);
    if (ex) return [];
    const wd2 = dfParts(locale, timezone, date).weekday.toLowerCase().slice(0,2);
    const map = { so:0, mo:1, di:2, mi:3, do:4, fr:5, sa:6 };
    return (week[String(map[wd2])] || []);
  }

  function getEffectiveWindows(cfg, date){
    const todayOrig = getOriginalRangesForDateRaw(cfg, date);
    const today = normalizeRanges(todayOrig);

    const prev  = addDaysUTC(date.getUTCFullYear(), date.getUTCMonth()+1, date.getUTCDate(), -1);
    const prevOrig = getOriginalRangesForDateRaw(cfg, prev);
    const prevSpillToday = [];
    prevOrig.forEach(([a,b])=>{
      const s = toMin(a), e = toMin(b);
      if (s > e && e > 0) prevSpillToday.push([0, e]); // ma 0:00–e
    });

    return [...prevSpillToday, ...today].sort((x,y)=>x[0]-y[0]);
  }

  function isOpenNow(cfg, now){
    const date = dateFromYMD(now.y, now.m, now.dd);
    const windows = getEffectiveWindows(cfg, date);
    for (const [s,e] of windows) {
      if (now.minutes >= s && now.minutes < e) return { open:true, closesAt:e };
    }
    return { open:false };
  }

  function findClosureUntil(cfg, now){
    const { locale, timezone, exceptions } = cfg;
    if (!exceptions?.length) return null;
    const today = dateFromYMD(now.y, now.m, now.dd);
    const key = ymd(locale, timezone, today);
    const hit = exceptions.find(e => key >= e.start && key <= e.end);
    if (!hit) return null;
    const [yy,mm,dd] = hit.end.split('-').map(Number);
    return dateFromYMD(yy,mm,dd);
  }

  function findNextOpen(cfg, now){
    for (let i=0; i<30; i++) {
      const d = addDaysUTC(now.y, now.m, now.dd, i);
      const todayEff = getEffectiveWindows(cfg, d);
      const candidates = (i===0) ? todayEff.filter(([s]) => s > now.minutes) : todayEff;
      if (candidates.length) {
        const [s] = candidates[0];
        let dayText = 'heute';
        if (i===1) dayText = 'morgen';
        else if (i>1) {
          const idx = (now.day + i) % 7;
          dayText = `am ${cfg.labels.days[idx]}`;
        }
        return { dayText, time: toHHMM(s), dateObj:d };
      }
    }
    return null;
  }

  function renderTable(cfg, currentDow){
    const tbody = document.querySelector('#hoursTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const order = [1,2,3,4,5,6,0]; // Hétfő -> Vasárnap

    order.forEach(d => {
      const tr = document.createElement('tr');
      if (d === currentDow) tr.classList.add('active');

      const tdDay  = document.createElement('td');
      tdDay.textContent = cfg.labels.days[d];

      const tdTime = document.createElement('td');
      tdTime.className = 'text-end';

      const orig = (cfg.week[String(d)] || []);
      tdTime.textContent = orig.length
        ? orig.map(([a,b]) => `${a} – ${b==='24:00'?'00:00':b}`).join(', ')
        : 'geschlossen';

      tr.append(tdDay, tdTime);
      tbody.appendChild(tr);
    });
  }

  function applyUI(cfg){
    const badgeOpen   = document.getElementById('badgeOpen');
    const badgeClosed = document.getElementById('badgeClosed');
    const statusText  = document.getElementById('statusText');
    if (!badgeOpen || !badgeClosed || !statusText) return;

    const tick = () => {
      const now = nowInTZ(cfg.locale, cfg.timezone);
      renderTable(cfg, now.day);

      const closureEnd = findClosureUntil(cfg, now);
      const state = isOpenNow(cfg, now);

      if (state.open) {
        const closeAt = state.closesAt === 24*60 ? '00:00' : toHHMM(state.closesAt);
        const minutesLeft = Math.max(0, state.closesAt - now.minutes);
        let soonText = '';
        if (minutesLeft === 0) soonText = ' – schließt jetzt';
        else if (minutesLeft <= 15) soonText = ` – schließt in ${minutesLeft} Min`;

        badgeClosed.classList.add('d-none');
        badgeOpen.classList.remove('d-none');
        statusText.textContent = cfg.labels.todayOpen.replace('{time}', closeAt) + soonText;
      } else {
        badgeOpen.classList.add('d-none');
        badgeClosed.classList.remove('d-none');

        if (closureEnd) {
          statusText.textContent = cfg.labels.closedUntil.replace('{date}', shortDE(cfg.locale, cfg.timezone, closureEnd));
        } else {
          const next = findNextOpen(cfg, now);
          statusText.textContent = next
            ? cfg.labels.closedOpens.replace('{dayText}', next.dayText).replace('{time}', next.time)
            : cfg.labels.closedBadge;
        }
      }
    };

    tick();
    const intervalId = setInterval(tick, 15 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); }, { passive:true });

    // ha valaha szükséges: visszatéréshez clearInterval(intervalId)
  }

  (async function init(){
    let cfg = null;
    try {
      const r = await fetch(CONFIG_URL, { cache: 'no-store', headers:{ 'Accept':'application/json' } });
      if (r.ok) {
        // védett JSON parse
        const text = await r.text();
        const j = text ? JSON.parse(text) : {};
        cfg = {
          timezone: j.timezone || FALLBACK.timezone,
          locale: j.locale || FALLBACK.locale,
          week: j.week || FALLBACK.week,
          exceptions: j.exceptions || [],
          overrides: j.overrides || [],
          labels: Object.assign({}, FALLBACK.labels, j.labels || {})
        };
      } else {
        cfg = FALLBACK;
      }
    } catch(e){
      console.warn('opening-hours.json nem elérhető, fallback indul.', e);
      cfg = FALLBACK;
    }
    applyUI(cfg);
  })();
})();

// ===========================================================
// Scroll-reveal (Animate.css v3)
// ===========================================================
(() => {
  const els = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window) || !els.length) return;

  const io = new IntersectionObserver((entries, obs)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('animated','fadeInUp');
        e.target.style.setProperty('--animate-duration', '700ms');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: .15 });

  els.forEach(el=>{
    el.style.opacity = 0;
    io.observe(el);
  });
})();

// ===========================================================
// Navbar auto-hide (finom)
// ===========================================================
(() => {
  const nav = document.querySelector('.navbar.sticky-top');
  if(!nav) return;
  let lastY = window.scrollY, hidden = false;

  window.addEventListener('scroll', ()=>{
    const y = window.scrollY;
    const down = y > lastY;
    lastY = y;
    if(down && y > 120 && !hidden){
      hidden = true; nav.style.transition='transform .25s ease';
      nav.style.transform='translateY(-100%)';
    } else if(!down && hidden){
      hidden = false; nav.style.transform='translateY(0)';
    }
  }, { passive:true });
})();