// Öffnungszeiten – Europe/Zurich, next open, kivételek, overrides
(() => {
  const CONFIG_URL = '/opening-hours.json';

  const FALLBACK = {
    timezone: 'Europe/Zurich',
    locale: 'de-CH',
    week: {
      0: [['09:00', '21:00']],
      1: [],
      2: [],
      3: [['09:00', '21:00']],
      4: [['09:00', '21:00']],
      5: [['09:00', '23:00']],
      6: [['09:00', '21:00']],
    },
    exceptions: [],
    overrides: [],
    labels: {
      days: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
      openBadge: 'GEÖFFNET',
      closedBadge: 'GESCHLOSSEN',
      todayOpen: 'Heute geöffnet – bis {time} Uhr',
      closedUntil: 'Geschlossen – bis einschließlich {date}',
      closedOpens: 'Geschlossen – öffnet {dayText} um {time} Uhr',
      timezone: 'Zeitzone: Europe/Zurich',
    },
  };

  // ---------- Util ----------
  function dfParts(locale, tz, date) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .reduce((a, p) => ((a[p.type] = p.value), a), {});
  }
  function nowInTZ(locale, tz) {
    const d = new Date();
    const p = dfParts(locale, tz, d);
    const wd2 = p.weekday.toLowerCase().slice(0, 2);
    const map = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
    const H = parseInt(p.hour, 10),
      M = parseInt(p.minute, 10),
      S = parseInt(p.second, 10);
    return {
      date: d,
      day: map[wd2],
      minutes: H * 60 + M,
      seconds: S,
      y: +p.year,
      m: +p.month,
      dd: +p.day,
      rawParts: p,
    };
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const toHHMM = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
  const dateFromYMD = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const addDaysUTC = (y, m, d, add) => new Date(Date.UTC(y, m - 1, d + add));
  const ymd = (locale, tz, date) => {
    const p = dfParts(locale, tz, date);
    return `${p.year}-${p.month}-${p.day}`;
  };
  const shortDE = (locale, tz, date) => {
    const p = dfParts(locale, tz, date);
    return `${p.day}.${p.month}.`;
  };

  function normalizeRanges(ranges) {
    const out = [];
    (ranges || []).forEach(([a, b]) => {
      const s = toMin(a),
        e = toMin(b);
      if (s < e) out.push([s, e]);
      else if (s > e) out.push([s, 24 * 60]); // átcsorgó sáv: ma éjfélig
    });
    return out.sort((x, y) => x[0] - y[0]);
  }

  function getOriginalRangesForDateRaw(cfg, date) {
    const { locale, timezone, week, exceptions, overrides } = cfg;
    const key = ymd(locale, timezone, date);
    const ov = (overrides || []).find((o) => o.date === key);
    if (ov) return ov.open || [];
    const ex = (exceptions || []).find((e) => key >= e.start && key <= e.end);
    if (ex) return [];
    const wd2 = dfParts(locale, timezone, date).weekday.toLowerCase().slice(0, 2);
    const map = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
    return week[String(map[wd2])] || [];
  }

  function getEffectiveWindows(cfg, date) {
    const todayOrig = getOriginalRangesForDateRaw(cfg, date);
    const today = normalizeRanges(todayOrig);

    const prev = addDaysUTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), -1);
    const prevOrig = getOriginalRangesForDateRaw(cfg, prev);
    const spill = [];
    prevOrig.forEach(([a, b]) => {
      const s = toMin(a),
        e = toMin(b);
      if (s > e && e > 0) spill.push([0, e]); // ma 0:00–e
    });

    return [...spill, ...today].sort((x, y) => x[0] - y[0]);
  }

  function isOpenNow(cfg, now) {
    const date = dateFromYMD(now.y, now.m, now.dd);
    const windows = getEffectiveWindows(cfg, date);
    for (const [s, e] of windows)
      if (now.minutes >= s && now.minutes < e) return { open: true, closesAt: e };
    return { open: false };
  }

  function findClosureUntil(cfg, now) {
    const { locale, timezone, exceptions } = cfg;
    if (!exceptions?.length) return null;
    const today = dateFromYMD(now.y, now.m, now.dd);
    const key = ymd(locale, timezone, today);
    const hit = exceptions.find((e) => key >= e.start && key <= e.end);
    if (!hit) return null;
    const [yy, mm, dd] = hit.end.split('-').map(Number);
    return dateFromYMD(yy, mm, dd);
  }

  function findNextOpen(cfg, now) {
    for (let i = 0; i < 30; i++) {
      const d = addDaysUTC(now.y, now.m, now.dd, i);
      const eff = getEffectiveWindows(cfg, d);
      const candidates = i === 0 ? eff.filter(([s]) => s > now.minutes) : eff;
      if (candidates.length) {
        const [s] = candidates[0];
        let dayText = 'heute';
        if (i === 1) dayText = 'morgen';
        else if (i > 1) {
          const idx = (now.day + i) % 7;
          dayText = `am ${cfg.labels.days[idx]}`;
        }
        return { dayText, time: toHHMM(s), dateObj: d };
      }
    }
    return null;
  }

  // ---------- Renderers ----------
  function renderTable(cfg, currentDow) {
    const tbody = document.querySelector('#hoursTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const order = [1, 2, 3, 4, 5, 6, 0]; // Hétfő -> Vasárnap
    order.forEach((d) => {
      const tr = document.createElement('tr');
      if (d === currentDow) tr.classList.add('active');

      const tdDay = document.createElement('td');
      tdDay.textContent = cfg.labels.days[d];

      const tdTime = document.createElement('td');
      tdTime.className = 'text-end';
      const orig = cfg.week[String(d)] || [];
      tdTime.textContent = orig.length
        ? orig.map(([a, b]) => `${a} – ${b === '24:00' ? '00:00' : b}`).join(', ')
        : 'geschlossen';

      tr.append(tdDay, tdTime);
      tbody.appendChild(tr);
    });
  }

  // **MÓDOSÍTOTT**: kapja meg a mai nap indexét, és tegye rá az .is-today osztályt
  function renderList(cfg, currentDow) {
    const list = document.getElementById('hoursList');
    if (!list) return;
    const order = [1, 2, 3, 4, 5, 6, 0]; // Hétfő -> Vasárnap

    list.innerHTML = order
      .map((d) => {
        const slots =
          (cfg.week[String(d)] || [])
            .map(([a, b]) => `${a} – ${b === '24:00' ? '00:00' : b}`)
            .join(', ') || 'geschlossen';
        const cls = d === currentDow ? 'is-today' : '';
        return `<li class="${cls}">
                <span>${cfg.labels.days[d]}</span>
                <span>${slots}</span>
              </li>`;
      })
      .join('');
  }

  // ---------- UI wiring ----------
  function applyUI(cfg) {
    const badgeOpen = document.getElementById('badgeOpen');
    const badgeClosed = document.getElementById('badgeClosed');
    const statusText = document.getElementById('statusText');
    const hasAnyUI =
      statusText ||
      badgeOpen ||
      badgeClosed ||
      document.querySelector('#hoursTable tbody') ||
      document.getElementById('hoursList');
    if (!hasAnyUI) return;

    const tick = () => {
      const now = nowInTZ(cfg.locale, cfg.timezone);

      // Lista/táblázat frissítése (ha vannak)
      renderList(cfg, now.day);
      renderTable(cfg, now.day);

      const closureEnd = findClosureUntil(cfg, now);
      const state = isOpenNow(cfg, now);
      const next = closureEnd ? null : findNextOpen(cfg, now);

      if (state.open) {
        const closeAt = state.closesAt === 24 * 60 ? '00:00' : toHHMM(state.closesAt);
        const minutesLeft = Math.max(0, state.closesAt - now.minutes);
        let soonText = '';
        if (minutesLeft === 0) soonText = ' – schließt jetzt';
        else if (minutesLeft <= 15) soonText = ` – schließt in ${minutesLeft} Min`;

        badgeClosed?.classList.add('d-none');
        badgeOpen?.classList.remove('d-none');
        if (statusText)
          statusText.textContent = cfg.labels.todayOpen.replace('{time}', closeAt) + soonText;
      } else {
        badgeOpen?.classList.add('d-none');
        badgeClosed?.classList.remove('d-none');

        let msg;
        if (closureEnd) {
          msg = cfg.labels.closedUntil.replace(
            '{date}',
            shortDE(cfg.locale, cfg.timezone, closureEnd),
          );
        } else {
          msg = next
            ? cfg.labels.closedOpens.replace('{dayText}', next.dayText).replace('{time}', next.time)
            : cfg.labels.closedBadge;
        }
        if (statusText) statusText.textContent = msg;
      }
    };

    tick();
    setInterval(tick, 60000);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) tick();
      },
      { passive: true },
    );
  }

  // ---------- Init ----------
  (async function init() {
    let cfg = null;
    try {
      const r = await fetch(CONFIG_URL, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const text = await r.text();
        const j = text ? JSON.parse(text) : {};
        cfg = {
          timezone: j.timezone || FALLBACK.timezone,
          locale: j.locale || FALLBACK.locale,
          week: j.week || FALLBACK.week,
          exceptions: j.exceptions || [],
          overrides: j.overrides || [],
          labels: Object.assign({}, FALLBACK.labels, j.labels || {}),
        };
      } else {
        cfg = FALLBACK;
      }
    } catch (e) {
      console.warn('opening-hours.json nem elérhető, fallback indul.', e);
      cfg = FALLBACK;
    }
    applyUI(cfg);
  })();
})();
