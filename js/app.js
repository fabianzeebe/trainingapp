// Trainingsapp – Oberfläche
import * as C from './core.js';
import * as E from './engine.js';
import * as S from './store.js';

const { escapeHtml: h } = C;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const SPORT = {
  run: { icon: '🏃', name: 'Lauf' },
  bike: { icon: '🚴', name: 'Rad' },
  gym: { icon: '🏋️', name: 'Gym' },
  race: { icon: '🏁', name: 'Wettkampf' },
  other: { icon: '✨', name: 'Sonstiges' },
};
const LOAD = { hard: 'Qualität', moderate: 'Moderat', easy: 'Locker' };

const app = {
  plan: null,
  state: S.loadState(),
  tab: 'week',
  week: null,
  month: null,
  review: null,
};

// ---------- Hilfen ----------
const today = () => C.todayStr();
const A = () => S.athleteOf(app.plan, app.state);
const save = () => {
  if (!S.saveState(app.state)) toast('⚠️ Speichern fehlgeschlagen – Speicher voll?');
};
const eff = () => E.effectiveSessions(app.plan, app.state);
const phaseOf = (d) => app.plan?.phases.find((p) => d >= p.start && d <= p.end) || null;
const weekInfo = (mon) => app.plan?.weeks.find((w) => w.start === mon) || null;
const num = (v) => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
};
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function status(s) {
  if (s.cancelled) return 'cancelled';
  const act = app.state.actuals[s.id];
  if (act?.done) return 'done';
  if (act?.missed) return 'missed';
  if (s.date < today()) return 'open';
  return 'planned';
}

// Die wichtigsten Intensitäten einer Einheit (nach Gesamtdauer sortiert)
function mainTargets(s, a) {
  const acc = new Map();
  const walk = (steps, mult) => {
    for (const st of steps || []) {
      if (st.rep) {
        walk(st.steps, mult * st.rep);
        continue;
      }
      if (st.t !== 'work') continue;
      const key = s.sport === 'bike' ? st.pct.join('-') : st.zone;
      const dur = (st.min ?? st.km * 4) * mult;
      const cur = acc.get(key) || { st, dur: 0 };
      cur.dur += dur;
      acc.set(key, cur);
    }
  };
  walk(s.steps, 1);
  return [...acc.values()]
    .sort((x, y) => y.dur - x.dur)
    .map(({ st }) => {
      if (s.sport === 'bike') {
        const w = C.bikeTarget(st.pct, a).watts;
        return `${w[0]}–${w[1]} W`;
      }
      const t = C.runTarget(st.zone, a);
      return t?.pace ? `${C.fmtPace(t.pace[0])}–${C.fmtPace(t.pace[1])}` : null;
    })
    .filter(Boolean)
    .slice(0, 2);
}

function planSummary(s, a) {
  const t = C.sessionTotals(s, a);
  if (s.sport === 'gym') return `${Math.round(t.min)}' Stabi`;
  if (s.sport === 'race') return `${C.fmtKm(s.raceKm, 1)} km · Ziel ${C.fmtMin(t.min)} (${C.fmtPace(s.racePace)}/km)`;
  const parts = [];
  if (s.sport === 'run') parts.push(`${C.fmtKm(Math.round(t.km * 2) / 2)} km`);
  parts.push(C.fmtMin(t.min));
  const tg = mainTargets(s, a);
  if (tg.length) parts.push(tg.join(' / ') + (s.sport === 'run' ? ' /km' : ''));
  return parts.join(' · ');
}

function actualSummary(act, sport, a) {
  if (!act?.done) return '';
  const p = [];
  if (act.km) p.push(`${C.fmtKm(act.km, 2)} km`);
  if (act.min) p.push(C.fmtMin(act.min));
  if ((sport === 'run' || sport === 'race') && act.km && act.min) p.push(`${C.fmtPace((act.min * 60) / act.km)}/km`);
  if (act.watts) p.push(`${act.watts} W (${(act.watts / a.weight).toFixed(2).replace('.', ',')} W/kg)`);
  if (act.hr) p.push(`HF ${act.hr}`);
  if (act.rpe) p.push(`RPE ${act.rpe}`);
  return p.join(' · ') || 'erledigt';
}

// ---------- Toast & Sheets ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

let closeTimer;
function openSheet(html, { onMount, wide } = {}) {
  clearTimeout(closeTimer);
  closeSheet(true);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="backdrop"></div><div class="sheet${wide ? ' wide' : ''}" role="dialog"><div class="grab"></div><button class="sheet-close" aria-label="Schließen">✕</button><div class="sheet-body">${html}</div></div>`;
  root.classList.add('open');
  document.body.classList.add('noscroll');
  $('.backdrop', root).onclick = () => closeSheet();
  $('.sheet-close', root).onclick = () => closeSheet();
  const sheet = $('.sheet', root);
  requestAnimationFrame(() => sheet.classList.add('in'));
  onMount?.(sheet);
  return sheet;
}
function closeSheet(immediate) {
  const root = $('#sheet-root');
  if (!root.classList.contains('open')) return;
  document.body.classList.remove('noscroll');
  if (immediate) {
    root.innerHTML = '';
    root.classList.remove('open');
    return;
  }
  $('.sheet', root)?.classList.remove('in');
  closeTimer = setTimeout(() => {
    root.innerHTML = '';
    root.classList.remove('open');
  }, 220);
}

// ---------- Render ----------
function render() {
  if (!app.plan) return;
  $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === app.tab));
  const view = $('#view');
  if (app.tab === 'week') view.innerHTML = renderWeek();
  else if (app.tab === 'month') view.innerHTML = renderMonth();
  else if (app.tab === 'review') view.innerHTML = renderReview();
  else view.innerHTML = renderMore();
  renderTopbar();
}

function renderTopbar() {
  const g = app.plan.goal;
  const days = C.daysBetween(today(), g.date);
  const ph = phaseOf(today());
  $('#topbar').innerHTML = `
    <div class="tb-left">
      <div class="tb-goal">${h(g.name)}</div>
      <div class="tb-sub">${days > 0 ? `noch <b>${days}</b> Tage · Ziel ${h(g.target)}` : days === 0 ? '<b>Heute ist Renntag! 🏁</b>' : `Ziel ${h(g.target)} · ${C.fmtDayMonth(g.date)}`}</div>
    </div>
    ${ph ? `<span class="phase-pill" style="--pc:${ph.color}">${h(ph.name)}</span>` : ''}`;
}

function navHeader(label, sub, kind) {
  return `<div class="nav-head">
    <button class="nav-btn" data-nav="${kind}" data-dir="-1" aria-label="Zurück">‹</button>
    <div class="nav-title"><div>${label}</div>${sub ? `<div class="nav-sub">${sub}</div>` : ''}</div>
    <button class="nav-btn" data-nav="${kind}" data-dir="1" aria-label="Weiter">›</button>
  </div>
  <div class="nav-today"><button data-nav="${kind}" data-dir="0">Heute</button></div>`;
}

function statBox(label, ist, soll, unit) {
  const p = soll > 0 ? Math.min(pct(ist, soll), 130) : 0;
  return `<div class="stat"><div class="stat-l">${label}</div><div class="stat-v"><b>${ist}</b><span>/ ${soll} ${unit}</span></div><div class="bar"><i style="width:${Math.min(p, 100)}%"></i></div></div>`;
}

function weekTotals(mon, map) {
  const a = A();
  const tot = { plan: { runKm: 0, bikeMin: 0, min: 0, n: 0 }, ist: { runKm: 0, bikeMin: 0, min: 0, n: 0 } };
  for (const d of C.weekDates(mon)) {
    const st = E.dayStats(map.get(d) || [], app.state, a);
    const ex = E.extraStats(app.state.extras[d]);
    for (const k of ['runKm', 'bikeMin', 'min', 'n']) {
      tot.plan[k] += st.plan[k];
      tot.ist[k] += st.ist[k];
    }
    tot.ist.runKm += ex.runKm;
    tot.ist.bikeMin += ex.bikeMin;
    tot.ist.min += ex.min;
  }
  return tot;
}

// ----- Woche -----
function renderWeek() {
  const mon = app.week;
  const a = A();
  const map = E.byDate(eff());
  const wi = weekInfo(mon);
  const ph = phaseOf(mon) || phaseOf(C.addDays(mon, 6));
  const tot = weekTotals(mon, map);
  const dates = C.weekDates(mon);
  const label = `KW ${C.isoWeek(mon)} · ${C.fmtDayMonth(mon)}–${C.fmtDayMonth(dates[6])}`;
  const sub = ph ? `<span class="dot" style="background:${ph.color}"></span>${h(ph.name)}${wi?.deload ? ' · Entlastung' : ''}` : 'kein Plan';

  const now = new Date();
  const isThisWeek = mon === C.mondayOf(today());
  const banner =
    isThisWeek && C.weekday(today()) === 6 && now.getHours() >= 16 && !app.state.weekNotes[mon]?.closed
      ? `<button class="banner" data-go-review="${mon}">📋 Sonntagabend: Zeit für den Wochenabgleich →</button>`
      : '';

  const first = app.plan.weeks[0]?.start;
  const beforeStart = first && mon < first && !dates.some((d) => map.get(d)?.length);
  const startCard = beforeStart
    ? `<div class="card"><h3>🚀 Der Plan startet am ${C.fmtLongDate(first)}</h3><p class="muted small">Bis dahin: locker erholen vom Halbmarathon. Zusatzeinheiten kannst du trotzdem pro Tag eintragen.</p><button class="btn primary block" data-go-week="${first}">Zur ersten Planwoche →</button></div>`
    : '';

  return `
  ${navHeader(label, sub, 'week')}
  ${startCard}
  ${banner}
  ${wi?.focus ? `<div class="focus" style="--pc:${ph?.color || '#888'}">${h(wi.focus)}</div>` : ''}
  <div class="stats">
    ${statBox('Lauf', C.fmtKm(tot.ist.runKm, 0), C.fmtKm(tot.plan.runKm, 0), 'km')}
    ${statBox('Rad', C.fmtKm(tot.ist.bikeMin / 60, 1), C.fmtKm(tot.plan.bikeMin / 60, 1), 'h')}
    ${statBox('Einheiten', tot.ist.n, tot.plan.n, '')}
  </div>
  <div class="days" id="days">
    ${dates.map((d) => dayCard(d, map.get(d) || [], a)).join('')}
  </div>
  <p class="hint">Tipp: Einheit am Griff ⠿ festhalten und auf einen anderen Tag ziehen, um sie zu verschieben.</p>`;
}

function illnessOn(d) {
  return (app.state.illnesses || []).find((i) => d >= i.start && d <= i.end);
}

function dayCard(d, list, a) {
  const wd = C.weekday(d);
  const isToday = d === today();
  const extras = app.state.extras[d] || [];
  const note = app.state.notes[d];
  const ill = illnessOn(d);
  const ph = phaseOf(d);
  return `<section class="day${isToday ? ' today' : ''}${d < today() ? ' past' : ''}" data-date="${d}" style="--pc:${ph?.color || '#999'}">
    <div class="day-head" data-open-day="${d}">
      <div class="day-name"><b>${C.DAY_SHORT[wd]}</b> ${C.fmtDayMonth(d)}${isToday ? ' <span class="today-tag">Heute</span>' : ''}</div>
      <div class="day-tags">${ill ? `<span class="tag ill">🤒 ${h(E.ILLNESS_TYPES[ill.type]?.short || 'krank')}</span>` : ''}${note ? '<span class="tag">💬</span>' : ''}<span class="more">⋯</span></div>
    </div>
    ${list.map((s) => sessRow(s, a)).join('')}
    ${!list.length && !extras.length ? `<div class="rest" data-open-day="${d}">😴 Ruhetag</div>` : ''}
    ${extras.map((x) => `<div class="sess extra" data-extra="${d}|${x.id}"><div class="sess-ic">${SPORT[x.sport]?.icon || '✨'}</div><div class="sess-main"><div class="sess-title">${h(x.title || SPORT[x.sport]?.name)} <span class="badge">Zusatz</span></div><div class="sess-ist">${h(actualSummary({ ...x, done: true }, x.sport, a))}</div></div></div>`).join('')}
    ${note ? `<div class="note" data-open-day="${d}">${h(note)}</div>` : ''}
  </section>`;
}

function sessRow(s, a) {
  const st = status(s);
  const act = app.state.actuals[s.id];
  const badge = s.sport === 'race' ? '<span class="badge race">Rennen</span>' : s.long ? '<span class="badge hard">Lang</span>' : s.load === 'hard' ? '<span class="badge hard">Q</span>' : s.load === 'moderate' ? '<span class="badge mod">M</span>' : '';
  return `<div class="sess s-${s.sport} st-${st}${s.modTag && !s.cancelled ? ' modded' : ''}" data-id="${s.id}">
    <div class="sess-ic">${SPORT[s.sport]?.icon || '•'}</div>
    <div class="sess-main">
      <div class="sess-title">${h(s.title)} ${badge}${s.slot === 'pm' ? '<span class="slot">PM</span>' : s.slot === 'am' ? '<span class="slot">AM</span>' : ''}</div>
      <div class="sess-sub">${s.cancelled ? h(s.cancelReason || 'abgesagt') : h(planSummary(s, a))}${s.movedFrom ? ` · <span class="moved">verschoben von ${C.DAY_SHORT[C.weekday(s.movedFrom)]}</span>` : ''}</div>
      ${act?.done ? `<div class="sess-ist">✓ ${h(actualSummary(act, s.sport, a))}</div>` : ''}
      ${act?.note ? `<div class="sess-note">„${h(act.note)}“</div>` : ''}
    </div>
    ${!s.cancelled && s.sport !== 'race' && st !== 'done' ? '<span class="grip" data-grip aria-label="Ziehen zum Verschieben">⠿</span>' : ''}
    ${s.cancelled ? '' : `<button class="check ${st}" data-check="${s.id}" aria-label="Abhaken">${st === 'done' ? '✓' : st === 'missed' ? '✕' : ''}</button>`}
  </div>`;
}

// ----- Monat -----
function renderMonth() {
  const first = app.month;
  const d0 = C.parseDate(first);
  const label = `${C.MONTHS[d0.getMonth()]} ${d0.getFullYear()}`;
  const start = C.mondayOf(first);
  const lastOfMonth = C.fmtDate(new Date(d0.getFullYear(), d0.getMonth() + 1, 0));
  const end = C.addDays(C.mondayOf(lastOfMonth), 6);
  const map = E.byDate(eff());
  const a = A();
  let cells = '';
  let mTot = { plan: { runKm: 0, bikeMin: 0, n: 0 }, ist: { runKm: 0, bikeMin: 0, n: 0 } };
  for (let wk = start; wk <= end; wk = C.addDays(wk, 7)) {
    const tot = weekTotals(wk, map);
    cells += `<div class="m-kw" data-go-week="${wk}"><b>${C.isoWeek(wk)}</b><span>${C.fmtKm(tot.plan.runKm, 0)}</span></div>`;
    for (const d of C.weekDates(wk)) {
      const inMonth = d.slice(0, 7) === first.slice(0, 7);
      const list = (map.get(d) || []).filter((s) => !s.cancelled);
      const cancelled = (map.get(d) || []).filter((s) => s.cancelled).length;
      const ph = phaseOf(d);
      if (inMonth) {
        const st = E.dayStats(map.get(d) || [], app.state, a);
        const ex = E.extraStats(app.state.extras[d]);
        mTot.plan.runKm += st.plan.runKm;
        mTot.ist.runKm += st.ist.runKm + ex.runKm;
        mTot.plan.bikeMin += st.plan.bikeMin;
        mTot.ist.bikeMin += st.ist.bikeMin + ex.bikeMin;
        mTot.plan.n += st.plan.n;
        mTot.ist.n += st.ist.n;
      }
      const icons = list
        .map((s) => `<span class="mi ${status(s)}${C.isHard(s) ? ' hard' : ''}">${SPORT[s.sport]?.icon}</span>`)
        .join('');
      const extra = (app.state.extras[d] || []).length ? '<span class="mi done">＋</span>' : '';
      cells += `<div class="m-cell${inMonth ? '' : ' out'}${d === today() ? ' today' : ''}" data-open-day="${d}" style="--pc:${ph?.color || 'transparent'}">
        <div class="m-d">${C.parseDate(d).getDate()}${illnessOn(d) ? ' 🤒' : ''}${app.state.notes[d] ? ' 💬' : ''}</div>
        <div class="m-icons">${icons || (cancelled ? '<span class="mi cancelled">✕</span>' : '<span class="m-rest">Ruhe</span>')}${extra}</div>
      </div>`;
    }
  }
  const phases = app.plan.phases
    .filter((p) => p.end >= start && p.start <= end)
    .map((p) => `<span class="legend"><i style="background:${p.color}"></i>${h(p.name)}</span>`)
    .join('');
  return `${navHeader(label, '', 'month')}
  <div class="stats">
    ${statBox('Lauf', C.fmtKm(mTot.ist.runKm, 0), C.fmtKm(mTot.plan.runKm, 0), 'km')}
    ${statBox('Rad', C.fmtKm(mTot.ist.bikeMin / 60, 1), C.fmtKm(mTot.plan.bikeMin / 60, 1), 'h')}
    ${statBox('Einheiten', mTot.ist.n, mTot.plan.n, '')}
  </div>
  <div class="month">
    <div class="m-hd">KW</div>${C.DAY_SHORT.map((d) => `<div class="m-hd">${d}</div>`).join('')}
    ${cells}
  </div>
  <div class="legends">${phases}</div>
  <p class="hint">Zahl unter der KW = geplante Lauf-km. Tippe auf einen Tag für Details, auf die KW für die Wochenansicht.</p>`;
}

// ----- Bilanz -----
function renderReview() {
  const mon = app.review;
  const a = A();
  const map = E.byDate(eff());
  const dates = C.weekDates(mon);
  const tot = weekTotals(mon, map);
  const wn = app.state.weekNotes[mon] || {};
  const ph = phaseOf(mon);
  const rpes = [];
  let rows = '';
  for (const d of dates) {
    const list = map.get(d) || [];
    const extras = app.state.extras[d] || [];
    const cells = [];
    for (const s of list) {
      const st = status(s);
      const act = app.state.actuals[s.id];
      if (act?.rpe) rpes.push(act.rpe);
      cells.push(`<div class="rv-row st-${st}" data-id="${s.id}">
        <div class="rv-soll">${SPORT[s.sport]?.icon} ${h(s.title)}<small>${s.cancelled ? h(s.cancelReason || '') : h(planSummary(s, a))}</small></div>
        <div class="rv-ist">${st === 'done' ? `✓ ${h(actualSummary(act, s.sport, a))}` : st === 'cancelled' ? '–' : st === 'missed' ? '✕ nicht gemacht' : st === 'open' ? '<span class="warn">offen</span>' : '<span class="muted">geplant</span>'}</div>
      </div>`);
    }
    for (const x of extras) {
      if (x.rpe) rpes.push(x.rpe);
      cells.push(`<div class="rv-row st-done" data-extra="${d}|${x.id}"><div class="rv-soll">${SPORT[x.sport]?.icon} <i>Zusatz</i><small>${h(x.title || '')}</small></div><div class="rv-ist">✓ ${h(actualSummary({ ...x, done: true }, x.sport, a))}</div></div>`);
    }
    if (!cells.length) cells.push('<div class="rv-row"><div class="rv-soll muted">😴 Ruhetag</div><div class="rv-ist"></div></div>');
    rows += `<div class="rv-day"><div class="rv-date" data-open-day="${d}"><b>${C.DAY_SHORT[C.weekday(d)]}</b> ${C.fmtDayMonth(d)}${app.state.notes[d] ? ' 💬' : ''}</div>${cells.join('')}${app.state.notes[d] ? `<div class="rv-note">${h(app.state.notes[d])}</div>` : ''}</div>`;
  }
  const comp = pct(tot.ist.n, tot.plan.n);
  const volComp = pct(tot.ist.min, tot.plan.min);
  const avgRpe = rpes.length ? (rpes.reduce((x, y) => x + y, 0) / rpes.length).toFixed(1).replace('.', ',') : '–';

  // Verlauf der letzten Wochen
  let hist = '';
  for (let i = 5; i >= 0; i--) {
    const wk = C.addDays(mon, -7 * i);
    const t = weekTotals(wk, map);
    if (!t.plan.n && !t.ist.n) continue;
    hist += `<tr${wk === mon ? ' class="cur"' : ''}><td>KW ${C.isoWeek(wk)}</td><td>${C.fmtKm(t.ist.runKm, 0)} / ${C.fmtKm(t.plan.runKm, 0)}</td><td>${C.fmtKm(t.ist.bikeMin / 60, 1)} / ${C.fmtKm(t.plan.bikeMin / 60, 1)}</td><td>${pct(t.ist.n, t.plan.n)} %</td></tr>`;
  }

  return `${navHeader(`Bilanz KW ${C.isoWeek(mon)}`, `${C.fmtDayMonth(mon)}–${C.fmtDayMonth(dates[6])}${ph ? ` · ${h(ph.name)}` : ''}`, 'review')}
  <div class="kpis">
    <div class="kpi"><b>${comp} %</b><span>Einheiten<br>${tot.ist.n}/${tot.plan.n}</span></div>
    <div class="kpi"><b>${volComp} %</b><span>Umfang (Zeit)<br>${C.fmtMin(tot.ist.min)} / ${C.fmtMin(tot.plan.min)}</span></div>
    <div class="kpi"><b>${avgRpe}</b><span>Ø RPE</span></div>
  </div>
  <div class="stats">
    ${statBox('Lauf', C.fmtKm(tot.ist.runKm, 1), C.fmtKm(tot.plan.runKm, 0), 'km')}
    ${statBox('Rad', C.fmtKm(tot.ist.bikeMin / 60, 1), C.fmtKm(tot.plan.bikeMin / 60, 1), 'h')}
  </div>
  <h3 class="sec">Soll / Ist pro Tag</h3>
  <div class="review">${rows}</div>
  <h3 class="sec">Wochenkommentar</h3>
  <textarea class="input" id="week-note" rows="4" placeholder="Wie lief die Woche? Müdigkeit, Schlaf, Beine, Besonderheiten …">${h(wn.text || '')}</textarea>
  ${wn.closed ? `<div class="closed">✅ Woche abgeschlossen am ${C.fmtDayMonth(wn.closed.slice(0, 10))} <button class="link" id="reopen-week">wieder öffnen</button></div>` : `<button class="btn primary block" id="close-week">Woche abschließen ✓</button>`}
  ${hist ? `<h3 class="sec">Verlauf (Ist / Soll)</h3><table class="hist"><tr><th></th><th>Lauf km</th><th>Rad h</th><th>Erfüllt</th></tr>${hist}</table>` : ''}`;
}

// ----- Mehr -----
function renderMore() {
  const a = A();
  const ills = [...(app.state.illnesses || [])].sort((x, y) => y.start.localeCompare(x.start));
  const runZones = ['REC', 'E', 'S', 'MP', 'HM', 'T', '10K', '5K', 'R'].map((z) => {
    const t = C.runTarget(z, a);
    return `<tr><td>${h(t.name)}</td><td>${t.pace ? `${C.fmtPace(t.pace[0])}–${C.fmtPace(t.pace[1])}` : '–'}</td><td>${t.hr ? (t.hr[0] ? `${t.hr[0]}–${t.hr[1]}` : `< ${t.hr[1]}`) : '–'}</td></tr>`;
  });
  const bikeZones = C.BIKE_ZONES.map((z) => {
    const t = C.bikeTarget(z.pct, a);
    return `<tr><td>${h(z.name)}</td><td>${z.pct[0]}–${z.pct[1]} %</td><td>${t.watts[0]}–${t.watts[1]} W</td><td>${t.wkg[0].toFixed(1).replace('.', ',')}–${t.wkg[1].toFixed(1).replace('.', ',')}</td></tr>`;
  });
  return `<h2 class="page-h">Mehr</h2>
  <div class="card">
    <h3>🤒 Krankheit / Verletzung</h3>
    <p class="muted">Melde Krankheit, der Plan wird automatisch angepasst (Absagen + Wiedereinstieg).</p>
    <button class="btn primary block" id="add-ill">Krankheit melden</button>
    ${ills.length ? `<div class="ill-list">${ills.map((i) => `<button class="ill-item" data-ill="${i.id}"><b>${h(E.ILLNESS_TYPES[i.type]?.short)}</b> ${C.fmtDayMonth(i.start)}–${C.fmtDayMonth(i.end)}${i.note ? ` · ${h(i.note)}` : ''}<span>›</span></button>`).join('')}</div>` : ''}
  </div>

  <div class="card">
    <h3>⚙️ Leistungswerte</h3>
    <div class="form-grid">
      <label>FTP (W)<input class="input" id="set-ftp" inputmode="numeric" value="${a.ftp}"></label>
      <label>Gewicht (kg)<input class="input" id="set-weight" inputmode="decimal" value="${String(a.weight).replace('.', ',')}"></label>
      <label>Schwelle Lauf (min/km)<input class="input" id="set-thr" inputmode="text" value="${C.fmtPace(a.thrPace)}"></label>
      <label>Schwellen-HF<input class="input" id="set-lthr" inputmode="numeric" value="${a.lthr}"></label>
      <label>HF max<input class="input" id="set-hrmax" inputmode="numeric" value="${a.hrMax}"></label>
      <label>W/kg<input class="input" disabled value="${(a.ftp / a.weight).toFixed(2).replace('.', ',')}"></label>
    </div>
    <button class="btn primary block" id="save-settings">Speichern & alle Zonen neu berechnen</button>
  </div>

  <div class="card">
    <h3>🏃 Lauf-Zonen</h3>
    <table class="zones"><tr><th>Zone</th><th>Pace /km</th><th>HF</th></tr>${runZones.join('')}</table>
    <p class="muted small">Marathon-Ziel ${h(app.plan.goal.target)} = ${C.fmtPace(app.plan.goal.targetPace)}/km</p>
    <h3>🚴 Rad-Zonen</h3>
    <table class="zones"><tr><th>Zone</th><th>% FTP</th><th>Watt</th><th>W/kg</th></tr>${bikeZones.join('')}</table>
  </div>

  <div class="card">
    <h3>🎨 Phasen</h3>
    ${app.plan.phases.map((p) => `<div class="phase-row"><i style="background:${p.color}"></i><b>${h(p.name)}</b><span>${C.fmtDayMonth(p.start)} – ${C.fmtDayMonth(p.end)}</span></div>`).join('')}
  </div>

  <div class="card">
    <h3>🔔 Sonntags-Erinnerung</h3>
    <ol class="steps-list">
      <li>App <b>Kurzbefehle</b> öffnen → Tab <b>Automation</b> → <b>＋</b> → <b>Tageszeit</b>.</li>
      <li><b>19:00</b>, <b>Wöchentlich</b>, nur <b>Sonntag</b> auswählen, <b>Sofort ausführen</b> wählen.</li>
      <li>Aktion <b>„URL öffnen“</b> hinzufügen mit:<br><code id="review-url">${h(location.origin + location.pathname)}#review</code> <button class="link" id="copy-url">kopieren</button></li>
      <li>Optional zusätzlich die Aktion <b>„Mitteilung zeigen“</b>: „Zeit für den Wochenabgleich 📋“.</li>
    </ol>
    <p class="muted small">Sonntags ab 16 Uhr erscheint außerdem ein Hinweis in der Wochenansicht.</p>
  </div>

  <div class="card">
    <h3>💾 Daten & Backup</h3>
    <p class="muted small">Deine Ist-Werte, Kommentare und Änderungen liegen nur auf diesem iPhone. Mach ab und zu ein Backup (z. B. in iCloud Drive).</p>
    <div class="btn-row">
      <button class="btn" id="export">Backup exportieren</button>
      <label class="btn">Backup importieren<input type="file" id="import" accept="application/json,.json" hidden></label>
    </div>
    <button class="btn block" id="reload-plan">Plan aktualisieren</button>
    <p class="muted small">Plan: ${h(app.plan.planId)} · Version ${app.plan.version} · erstellt ${h(app.plan.generated)}</p>
  </div>

  <div class="card">
    <h3>📱 Als App installieren</h3>
    <p class="muted small">In Safari unten auf <b>Teilen</b> (Quadrat mit Pfeil) → <b>Zum Home-Bildschirm</b>. Danach startet die App im Vollbild und funktioniert auch offline.</p>
  </div>`;
}

// ---------- Sheets: Einheit ----------
function stepHtml(st, sport, a) {
  if (st.rep) return `<div class="rep"><div class="rep-n">${st.rep}×</div><div class="rep-b">${st.steps.map((x) => stepHtml(x, sport, a)).join('')}</div></div>`;
  const amount = st.km != null ? C.fmtDist(st.km) : C.fmtStepMin(st.min);
  let target = '';
  let cls = st.t;
  if (sport === 'bike') {
    const t = C.bikeTarget(st.pct, a);
    target = `${st.pct[0]}–${st.pct[1]} % · <b>${t.watts[0]}–${t.watts[1]} W</b> · ${t.wkg[0].toFixed(1).replace('.', ',')}–${t.wkg[1].toFixed(1).replace('.', ',')} W/kg`;
    if (st.cad) target += ` · ${h(st.cad)}`;
    if (st.t === 'work') {
      const hr = C.bikeHr(st.pct, a);
      if (hr) target += ` · HF ~${hr[0]}–${hr[1]}`;
    }
    cls += st.pct[1] >= 106 ? ' z-vo2' : st.pct[1] >= 95 ? ' z-thr' : st.pct[1] >= 86 ? ' z-ss' : st.pct[1] >= 76 ? ' z-tempo' : '';
  } else {
    const t = C.runTarget(st.zone, a);
    if (t?.pace) target = `<b>${C.fmtPace(t.pace[0])}–${C.fmtPace(t.pace[1])}/km</b>`;
    else if (t?.effort) target = h(t.effort);
    if (t?.hr) target += ` · HF ${t.hr[0] ? `${t.hr[0]}–${t.hr[1]}` : `< ${t.hr[1]}`}`;
    cls += ` z-${st.zone}`;
  }
  return `<div class="step ${cls}"><div class="step-a">${amount}</div><div class="step-t"><div>${h(st.label || C.RUN_ZONES[st.zone]?.name || '')}</div><small>${target}</small></div></div>`;
}

function openSession(id) {
  const s = eff().find((x) => x.id === id);
  if (!s) return;
  const a = A();
  const t = C.sessionTotals(s, a);
  const act = app.state.actuals[id] || {};
  const ph = phaseOf(s.date);
  const st = status(s);
  const isRun = s.sport === 'run' || s.sport === 'race';
  const durH = act.min ? Math.floor(act.min / 60) : '';
  const durM = act.min ? Math.round(act.min % 60) : '';

  const details =
    s.sport === 'gym'
      ? `<ul class="ex">${(s.exercises || []).map((e) => `<li>${h(e)}</li>`).join('')}</ul>`
      : s.sport === 'race'
        ? `<div class="race-box">🏁 ${C.fmtKm(s.raceKm, 3)} km · Zielpace <b>${C.fmtPace(s.racePace)}/km</b> · Zielzeit <b>${C.fmtMin(t.min)}</b></div>`
        : `<div class="steps">${s.steps.map((x) => stepHtml(x, s.sport, a)).join('')}</div>`;

  const html = `
  <div class="ss-head">
    <div class="ss-ic">${SPORT[s.sport]?.icon}</div>
    <div>
      <div class="ss-date">${C.fmtLongDate(s.date)}${s.slot ? ` · ${s.slot === 'am' ? 'morgens' : 'nachmittags/abends'}` : ''}</div>
      <h2>${h(s.title)}</h2>
      <div class="ss-tags">${ph ? `<span class="phase-pill sm" style="--pc:${ph.color}">${h(ph.name)}</span>` : ''}<span class="badge ${s.load === 'hard' ? 'hard' : s.load === 'moderate' ? 'mod' : ''}">${s.long ? 'Langer Lauf' : LOAD[s.load] || ''}</span></div>
    </div>
  </div>
  ${s.cancelled ? `<div class="alert">❌ ${h(s.cancelReason || 'Abgesagt')}</div>` : ''}
  ${s.modNote && !s.cancelled ? `<div class="alert info">🔄 Angepasst: ${h(s.modNote)}</div>` : ''}
  ${s.movedFrom ? `<div class="alert info">📅 Verschoben von ${C.fmtLongDate(s.movedFrom)}</div>` : ''}
  <div class="ss-total">${s.sport === 'gym' ? `${Math.round(t.min)} min` : `${isRun ? `<b>${C.fmtKm(t.km, 1)} km</b> · ` : ''}<b>${C.fmtMin(t.min)}</b>`}</div>
  <p class="desc">${h(s.desc || '')}</p>
  ${details}
  ${s.original ? `<details class="orig"><summary>Ursprünglich geplant: ${h(s.original.title)}</summary><p class="muted small">${h(planSummary(s.original, a))}</p></details>` : ''}

  ${
    s.cancelled
      ? ''
      : `<h3 class="sec">Ist-Werte ${st === 'done' ? '✓' : ''}</h3>
  <form id="ist-form" class="ist">
    <div class="form-grid">
      <label>Dauer Std<input class="input" name="h" inputmode="numeric" value="${durH}" placeholder="${Math.floor(t.min / 60)}"></label>
      <label>Min<input class="input" name="m" inputmode="numeric" value="${durM}" placeholder="${Math.round(t.min % 60)}"></label>
      ${s.sport !== 'gym' ? `<label>Distanz km<input class="input" name="km" inputmode="decimal" value="${act.km != null ? String(act.km).replace('.', ',') : ''}" placeholder="${isRun ? C.fmtKm(t.km, 1) : 'optional'}"></label>` : ''}
      ${s.sport === 'bike' ? `<label>Ø Watt<input class="input" name="watts" inputmode="numeric" value="${act.watts ?? ''}" placeholder="z. B. 230"></label>` : ''}
      ${s.sport !== 'gym' ? `<label>Ø HF<input class="input" name="hr" inputmode="numeric" value="${act.hr ?? ''}" placeholder="bpm"></label>` : ''}
      <div class="calc" id="calc"></div>
    </div>
    <div class="rpe-l">Anstrengung (RPE)</div>
    <div class="rpe">${Array.from({ length: 10 }, (_, i) => `<button type="button" data-rpe="${i + 1}" class="${act.rpe === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div>
    <textarea class="input" name="note" rows="2" placeholder="Kommentar zur Einheit (Gefühl, Wetter, Besonderheiten)">${h(act.note || '')}</textarea>
    <div class="btn-row">
      <button type="button" class="btn" id="as-planned">Wie geplant ✓</button>
      <button type="submit" class="btn primary">Speichern</button>
    </div>
    <div class="btn-row">
      ${st !== 'missed' ? '<button type="button" class="btn ghost" id="missed">Nicht gemacht</button>' : ''}
      ${act.done || act.missed ? '<button type="button" class="btn ghost" id="reset-ist">Ist zurücksetzen</button>' : ''}
    </div>
  </form>`
  }
  <h3 class="sec">Plan ändern</h3>
  <div class="btn-row">
    ${!s.cancelled && s.sport !== 'race' && st !== 'done' ? '<button class="btn" id="move">📅 Verschieben</button>' : ''}
    ${s.cancelled && s.modTag === 'skip' ? '<button class="btn" id="unskip">Wiederherstellen</button>' : !s.cancelled && s.sport !== 'race' && st !== 'done' ? '<button class="btn" id="skip">Auslassen</button>' : ''}
    ${s.original && !String(s.modTag || '').startsWith('ill:') ? '<button class="btn" id="restore">Original wiederherstellen</button>' : ''}
  </div>`;

  openSheet(html, {
    onMount(sheet) {
      const form = $('#ist-form', sheet);
      let rpe = act.rpe || null;
      const read = () => {
        const fd = new FormData(form);
        const hh = num(fd.get('h')) || 0;
        const mm = num(fd.get('m')) || 0;
        return { min: hh * 60 + mm || null, km: num(fd.get('km')), watts: num(fd.get('watts')), hr: num(fd.get('hr')), note: (fd.get('note') || '').trim() };
      };
      const calc = () => {
        if (!form) return;
        const v = read();
        let txt = '';
        if (isRun && v.min && v.km) txt = `Ø Pace ${C.fmtPace((v.min * 60) / v.km)}/km`;
        if (s.sport === 'bike' && v.watts) txt = `${(v.watts / a.weight).toFixed(2).replace('.', ',')} W/kg · ${pct(v.watts, a.ftp)} % FTP`;
        $('#calc', sheet).textContent = txt;
      };
      if (form) {
        form.addEventListener('input', calc);
        calc();
        $$('[data-rpe]', form).forEach((b) =>
          b.addEventListener('click', () => {
            rpe = Number(b.dataset.rpe);
            $$('[data-rpe]', form).forEach((x) => x.classList.toggle('on', x === b));
          }),
        );
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const v = read();
          app.state.actuals[id] = { done: true, date: s.date, min: v.min ?? Math.round(t.min), km: v.km ?? (isRun ? Math.round(t.km * 10) / 10 : null), watts: v.watts, hr: v.hr, rpe, note: v.note, ts: Date.now() };
          save();
          closeSheet();
          render();
          toast('Gespeichert ✓');
        });
        $('#as-planned', sheet).onclick = () => {
          const v = read();
          app.state.actuals[id] = { done: true, date: s.date, min: Math.round(t.min), km: isRun ? Math.round(t.km * 10) / 10 : null, watts: v.watts, hr: v.hr, rpe, note: v.note, ts: Date.now() };
          save();
          closeSheet();
          render();
          toast('Abgehakt ✓');
        };
        const missed = $('#missed', sheet);
        if (missed)
          missed.onclick = () => {
            app.state.actuals[id] = { done: false, missed: true, date: s.date, note: read().note, ts: Date.now() };
            save();
            closeSheet();
            render();
          };
        const reset = $('#reset-ist', sheet);
        if (reset)
          reset.onclick = () => {
            delete app.state.actuals[id];
            save();
            closeSheet();
            render();
          };
      }
      const mv = $('#move', sheet);
      if (mv) mv.onclick = () => openMovePicker(id);
      const sk = $('#skip', sheet);
      if (sk)
        sk.onclick = () => {
          E.setSkipped(app.state, id, true);
          save();
          closeSheet();
          render();
          toast('Einheit ausgelassen');
        };
      const us = $('#unskip', sheet);
      if (us)
        us.onclick = () => {
          E.setSkipped(app.state, id, false);
          save();
          closeSheet();
          render();
        };
      const rs = $('#restore', sheet);
      if (rs)
        rs.onclick = () => {
          const o = app.state.overrides[id];
          if (o) {
            delete o.replaced;
            delete o.modNote;
            delete o.modTag;
            if (!Object.keys(o).length) delete app.state.overrides[id];
          }
          save();
          closeSheet();
          render();
        };
    },
  });
}

// ---------- Verschieben ----------
function openMovePicker(id) {
  const s = eff().find((x) => x.id === id);
  const map = E.byDate(eff());
  const mon = C.mondayOf(s.date);
  const chips = (start) =>
    C.weekDates(start)
      .map((d) => {
        const icons = (map.get(d) || []).filter((x) => !x.cancelled && x.id !== id).map((x) => SPORT[x.sport]?.icon).join('') || '😴';
        return `<button class="day-chip${d === s.date ? ' cur' : ''}${d < today() ? ' past' : ''}" data-to="${d}" ${d === s.date ? 'disabled' : ''}><b>${C.DAY_SHORT[C.weekday(d)]} ${C.fmtDayMonth(d)}</b><span>${icons}</span></button>`;
      })
      .join('');
  openSheet(
    `<h2>Verschieben</h2>
    <p class="muted">${SPORT[s.sport]?.icon} <b>${h(s.title)}</b> · aktuell ${C.fmtLongDate(s.date)}</p>
    <h3 class="sec">Diese Woche</h3><div class="chips">${chips(mon)}</div>
    <h3 class="sec">Nächste Woche</h3><div class="chips">${chips(C.addDays(mon, 7))}</div>
    <h3 class="sec">Anderes Datum</h3>
    <div class="btn-row"><input type="date" class="input" id="other-date" value="${s.date}"><button class="btn" id="other-go">OK</button></div>`,
    {
      onMount(sheet) {
        $$('[data-to]', sheet).forEach((b) => (b.onclick = () => openMoveProposal(id, b.dataset.to)));
        $('#other-go', sheet).onclick = () => {
          const v = $('#other-date', sheet).value;
          if (v && v !== s.date) openMoveProposal(id, v);
        };
      },
    },
  );
}

function openMoveProposal(id, toDate) {
  const p = E.proposeMove(app.plan, app.state, id, toDate, today());
  if (!p) return;
  const byId = new Map(eff().map((x) => [x.id, x]));
  const dname = (d) => `${C.DAY_SHORT[C.weekday(d)]} ${C.fmtDayMonth(d)}`;
  const others = p.moves.slice(1);
  const list = (arr) => arr.map((i) => `<li>${h(i)}</li>`).join('');
  openSheet(
    `<h2>Woche anpassen</h2>
    <div class="move-main">${SPORT[p.session.sport]?.icon} <b>${h(p.session.title)}</b><br>${dname(p.moves[0].from)} → <b>${dname(toDate)}</b></div>
    ${
      others.length
        ? `<h3 class="sec">Vorschlag – damit die Woche wieder passt:</h3>
           <ul class="moves">${others.map((m) => `<li>${SPORT[byId.get(m.id)?.sport]?.icon || ''} ${h(byId.get(m.id)?.title || m.id)}<br><small>${dname(m.from)} → <b>${dname(m.to)}</b></small></li>`).join('')}</ul>
           ${p.simple.length ? `<p class="muted small">Ohne Anpassung: ${p.simple.map(h).join(' · ')}</p>` : ''}`
        : p.simple.length
          ? ''
          : '<p class="ok">👍 Passt ohne weitere Änderungen in die Woche.</p>'
    }
    ${p.after.length ? `<div class="alert"><b>Hinweis:</b><ul>${list(p.after)}</ul></div>` : ''}
    <div class="btn-col">
      <button class="btn primary block" id="apply-all">${others.length ? 'Vorschlag übernehmen' : 'Verschieben'}</button>
      ${others.length ? '<button class="btn block" id="apply-one">Nur diese Einheit verschieben</button>' : ''}
      <button class="btn ghost block" id="cancel-move">Abbrechen</button>
    </div>`,
    {
      onMount(sheet) {
        const done = (moves) => {
          E.applyMoves(app.plan, app.state, moves);
          save();
          closeSheet();
          if (app.tab === 'week' && C.mondayOf(toDate) !== app.week && C.mondayOf(toDate) !== C.mondayOf(p.moves[0].from)) app.week = C.mondayOf(toDate);
          render();
          toast(moves.length > 1 ? `Woche angepasst (${moves.length} Änderungen)` : 'Verschoben ✓');
        };
        $('#apply-all', sheet).onclick = () => done(p.moves);
        const one = $('#apply-one', sheet);
        if (one) one.onclick = () => done([p.moves[0]]);
        $('#cancel-move', sheet).onclick = () => closeSheet();
      },
    },
  );
}

// ---------- Tag ----------
function openDay(d) {
  const a = A();
  const list = E.byDate(eff()).get(d) || [];
  const extras = app.state.extras[d] || [];
  const ph = phaseOf(d);
  openSheet(
    `<div class="ss-date">${ph ? `<span class="phase-pill sm" style="--pc:${ph.color}">${h(ph.name)}</span> ` : ''}</div>
    <h2>${C.fmtLongDate(d)}</h2>
    <div class="day-list">
      ${list.map((s) => sessRow(s, a)).join('') || '<div class="rest">😴 Ruhetag</div>'}
      ${extras.map((x) => `<div class="sess extra" data-extra="${d}|${x.id}"><div class="sess-ic">${SPORT[x.sport]?.icon}</div><div class="sess-main"><div class="sess-title">${h(x.title || SPORT[x.sport]?.name)} <span class="badge">Zusatz</span></div><div class="sess-ist">${h(actualSummary({ ...x, done: true }, x.sport, a))}</div></div></div>`).join('')}
    </div>
    <button class="btn block" id="add-extra">＋ Zusatzeinheit eintragen</button>
    <h3 class="sec">Kommentar zum Tag</h3>
    <textarea class="input" id="day-note" rows="3" placeholder="Schlaf, Beine, Stress, Wetter …">${h(app.state.notes[d] || '')}</textarea>
    <button class="btn ghost block" id="ill-here">🤒 Ab diesem Tag krank melden</button>`,
    {
      onMount(sheet) {
        bindSessionClicks(sheet);
        const ta = $('#day-note', sheet);
        let tmr;
        ta.addEventListener('input', () => {
          clearTimeout(tmr);
          tmr = setTimeout(() => {
            const v = ta.value.trim();
            if (v) app.state.notes[d] = v;
            else delete app.state.notes[d];
            save();
            render();
          }, 400);
        });
        $('#add-extra', sheet).onclick = () => openExtra(d);
        $('#ill-here', sheet).onclick = () => openIllness(null, d);
      },
    },
  );
}

// ---------- Zusatzeinheit ----------
function openExtra(d, xid) {
  const list = app.state.extras[d] || [];
  const x = list.find((e) => e.id === xid) || { sport: 'run' };
  const a = A();
  openSheet(
    `<h2>${xid ? 'Zusatzeinheit' : 'Zusatzeinheit eintragen'}</h2>
    <p class="muted">${C.fmtLongDate(d)}</p>
    <form id="extra-form" class="ist">
      <div class="seg">${['run', 'bike', 'gym', 'other'].map((k) => `<label><input type="radio" name="sport" value="${k}" ${x.sport === k ? 'checked' : ''}><span>${SPORT[k].icon} ${SPORT[k].name}</span></label>`).join('')}</div>
      <input class="input" name="title" placeholder="Titel (optional)" value="${h(x.title || '')}">
      <div class="form-grid">
        <label>Dauer Std<input class="input" name="h" inputmode="numeric" value="${x.min ? Math.floor(x.min / 60) : ''}"></label>
        <label>Min<input class="input" name="m" inputmode="numeric" value="${x.min ? Math.round(x.min % 60) : ''}"></label>
        <label data-for="run bike">Distanz km<input class="input" name="km" inputmode="decimal" value="${x.km != null ? String(x.km).replace('.', ',') : ''}"></label>
        <label data-for="bike">Ø Watt<input class="input" name="watts" inputmode="numeric" value="${x.watts ?? ''}"></label>
        <label data-for="run bike other">Ø HF<input class="input" name="hr" inputmode="numeric" value="${x.hr ?? ''}"></label>
        <div class="calc" id="x-calc"></div>
      </div>
      <div class="rpe-l">Anstrengung (RPE)</div>
      <div class="rpe">${Array.from({ length: 10 }, (_, i) => `<button type="button" data-rpe="${i + 1}" class="${x.rpe === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div>
      <textarea class="input" name="note" rows="2" placeholder="Kommentar">${h(x.note || '')}</textarea>
      <button class="btn primary block" type="submit">Speichern</button>
      ${xid ? '<button class="btn ghost block" type="button" id="del-extra">Löschen</button>' : ''}
    </form>`,
    {
      onMount(sheet) {
        const form = $('#extra-form', sheet);
        let rpe = x.rpe || null;
        // nur die Felder zeigen, die zur Sportart passen; Pace bzw. W/kg live berechnen
        const update = () => {
          const sp = form.elements.sport.value;
          $$('[data-for]', form).forEach((el) => (el.hidden = !el.dataset.for.split(' ').includes(sp)));
          const fd = new FormData(form);
          const min = (num(fd.get('h')) || 0) * 60 + (num(fd.get('m')) || 0);
          const km = num(fd.get('km'));
          const w = num(fd.get('watts'));
          let txt = '';
          if (sp === 'run' && min && km) txt = `Ø Pace ${C.fmtPace((min * 60) / km)}/km`;
          if (sp === 'bike' && w) txt = `${(w / a.weight).toFixed(2).replace('.', ',')} W/kg · ${pct(w, a.ftp)} % FTP`;
          $('#x-calc', sheet).textContent = txt;
        };
        form.addEventListener('input', update);
        form.addEventListener('change', update);
        update();
        $$('[data-rpe]', form).forEach((b) =>
          b.addEventListener('click', () => {
            rpe = Number(b.dataset.rpe);
            $$('[data-rpe]', form).forEach((y) => y.classList.toggle('on', y === b));
          }),
        );
        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const min = (num(fd.get('h')) || 0) * 60 + (num(fd.get('m')) || 0);
          const sp = fd.get('sport');
          const entry = { id: xid || `x${Date.now()}`, sport: sp, title: fd.get('title').trim(), min: min || null, km: sp === 'run' || sp === 'bike' ? num(fd.get('km')) : null, watts: sp === 'bike' ? num(fd.get('watts')) : null, hr: sp === 'gym' ? null : num(fd.get('hr')), rpe, note: fd.get('note').trim() };
          const arr = (app.state.extras[d] ||= []);
          const i = arr.findIndex((e2) => e2.id === entry.id);
          if (i >= 0) arr[i] = entry;
          else arr.push(entry);
          save();
          closeSheet();
          render();
          toast('Zusatzeinheit gespeichert');
        };
        const del = $('#del-extra', sheet);
        if (del)
          del.onclick = () => {
            app.state.extras[d] = list.filter((e) => e.id !== xid);
            if (!app.state.extras[d].length) delete app.state.extras[d];
            save();
            closeSheet();
            render();
          };
      },
    },
  );
}

// ---------- Krankheit ----------
function openIllness(illId, startDate) {
  const ex = (app.state.illnesses || []).find((i) => i.id === illId);
  const ill = ex || { type: 'neck', start: startDate || today(), end: C.addDays(startDate || today(), 2), note: '' };
  openSheet(
    `<h2>${ex ? 'Krankheit bearbeiten' : 'Krankheit melden'}</h2>
    <form id="ill-form" class="ist">
      <div class="radio-list">${Object.entries(E.ILLNESS_TYPES).map(([k, v]) => `<label><input type="radio" name="type" value="${k}" ${ill.type === k ? 'checked' : ''}><span>${h(v.label)}</span></label>`).join('')}</div>
      <div class="form-grid">
        <label>Von<input class="input" type="date" name="start" value="${ill.start}"></label>
        <label>Bis (voraussichtlich)<input class="input" type="date" name="end" value="${ill.end}"></label>
      </div>
      <input class="input" name="note" placeholder="Was genau? (z. B. Halsschmerzen, Schnupfen)" value="${h(ill.note || '')}">
      <div class="rules muted small">
        <b>Regeln:</b> Fieber/Infekt/Magen-Darm → alles fällt aus, bei Fieber +1 Tag Pause. Danach Wiedereinstieg: ≤3 Tage krank → 2 Tage locker · 4–7 Tage → 1 Woche ohne Intensität (~70 %) · >7 Tage → 2 Wochen Aufbau.
        Erkältung oberhalb des Halses → nur kurz & locker, kein Gym. Verletzung → Laufen wird durch lockeres Rad ersetzt. Das Renndatum bleibt fix.
        Bis-Datum später einfach anpassen, der Plan rechnet neu.
      </div>
      <button class="btn primary block" type="submit">${ex ? 'Speichern & Plan neu anpassen' : 'Melden & Plan anpassen'}</button>
      ${ex ? `<button class="btn block" type="button" id="healthy">💪 Ab heute wieder gesund</button><button class="btn ghost block" type="button" id="del-ill">Eintrag löschen (Anpassungen zurücknehmen)</button>` : ''}
    </form>`,
    {
      onMount(sheet) {
        const form = $('#ill-form', sheet);
        const apply = (entry) => {
          const list = (app.state.illnesses ||= []);
          const i = list.findIndex((x) => x.id === entry.id);
          if (i >= 0) list[i] = entry;
          else list.push(entry);
          const r = E.applyIllness(app.plan, app.state, entry, A());
          save();
          closeSheet();
          render();
          openSheet(
            `<h2>Plan angepasst</h2>
            <p>${r.changes} Einheiten wurden abgesagt oder angepasst. Wiedereinstieg bis <b>${C.fmtLongDate(r.until)}</b>.</p>
            ${r.warnings.map((w) => `<div class="alert">${h(w)}</div>`).join('')}
            <p class="muted small">Gute Besserung! 🍵 Wenn du früher/später gesund bist, passe das Bis-Datum unter „Mehr → Krankheit“ an.</p>
            <button class="btn primary block" id="ok-ill">OK</button>`,
            { onMount: (sh) => ($('#ok-ill', sh).onclick = () => closeSheet()) },
          );
        };
        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const start = fd.get('start');
          let end = fd.get('end');
          if (!start) return toast('Bitte Startdatum angeben');
          if (!end || end < start) end = start;
          apply({ id: ill.id || `i${Date.now()}`, type: fd.get('type'), start, end, note: fd.get('note').trim() });
        };
        const healthy = $('#healthy', sheet);
        if (healthy)
          healthy.onclick = () => {
            const end = C.addDays(today(), -1) >= ill.start ? C.addDays(today(), -1) : ill.start;
            apply({ ...ill, end });
          };
        const del = $('#del-ill', sheet);
        if (del)
          del.onclick = () => {
            E.clearTag(app.state, `ill:${ill.id}`);
            app.state.illnesses = app.state.illnesses.filter((x) => x.id !== ill.id);
            save();
            closeSheet();
            render();
            toast('Krankheit gelöscht, Plan zurückgesetzt');
          };
      },
    },
  );
}

// ---------- Interaktion ----------
function quickCheck(id) {
  const s = eff().find((x) => x.id === id);
  if (!s) return;
  const st = status(s);
  if (st === 'done' || st === 'missed') return openSession(id);
  const t = C.sessionTotals(s, A());
  app.state.actuals[id] = { done: true, date: s.date, min: Math.round(t.min), km: s.sport === 'run' || s.sport === 'race' ? Math.round(t.km * 10) / 10 : null, ts: Date.now() };
  save();
  render();
  toast('Abgehakt ✓ – tippe auf die Einheit, um Ist-Werte zu ergänzen');
}

let suppressClick = false;
function bindSessionClicks(root) {
  root.addEventListener('click', (e) => {
    if (suppressClick) return;
    const chk = e.target.closest('[data-check]');
    if (chk) {
      e.stopPropagation();
      return quickCheck(chk.dataset.check);
    }
    const ex = e.target.closest('[data-extra]');
    if (ex) {
      const [d, id] = ex.dataset.extra.split('|');
      return openExtra(d, id);
    }
    const row = e.target.closest('[data-id]');
    if (row) return openSession(row.dataset.id);
  });
}

function onViewClick(e) {
  if (suppressClick) return;
  const nav = e.target.closest('[data-nav]');
  if (nav) return navigate(nav.dataset.nav, Number(nav.dataset.dir));
  const gw = e.target.closest('[data-go-week]');
  if (gw) {
    app.week = gw.dataset.goWeek;
    app.tab = 'week';
    return render();
  }
  const gr = e.target.closest('[data-go-review]');
  if (gr) {
    app.review = gr.dataset.goReview;
    app.tab = 'review';
    return render();
  }
  if (e.target.closest('[data-check],[data-extra],[data-id]')) return; // von bindSessionClicks behandelt
  const od = e.target.closest('[data-open-day]');
  if (od) return openDay(od.dataset.openDay);
  const il = e.target.closest('[data-ill]');
  if (il) return openIllness(il.dataset.ill);
  const id = e.target.id;
  if (id === 'add-ill') return openIllness(null);
  if (id === 'save-settings') return saveSettings();
  if (id === 'export') return doExport();
  if (id === 'reload-plan') return loadPlan(true);
  if (id === 'copy-url') {
    navigator.clipboard?.writeText($('#review-url').textContent).then(() => toast('Link kopiert'));
    return;
  }
  if (id === 'close-week' || id === 'reopen-week') {
    const wn = (app.state.weekNotes[app.review] ||= {});
    if (id === 'close-week') wn.closed = new Date().toISOString();
    else delete wn.closed;
    save();
    render();
    if (id === 'close-week') toast('Woche abgeschlossen 💪');
  }
}

function navigate(kind, dir) {
  const t = today();
  if (kind === 'week') app.week = dir === 0 ? C.mondayOf(t) : C.addDays(app.week, 7 * dir);
  if (kind === 'review') app.review = dir === 0 ? C.mondayOf(t) : C.addDays(app.review, 7 * dir);
  if (kind === 'month') {
    if (dir === 0) app.month = t.slice(0, 8) + '01';
    else {
      const d = C.parseDate(app.month);
      app.month = C.fmtDate(new Date(d.getFullYear(), d.getMonth() + dir, 1));
    }
  }
  render();
  $('#view').scrollTo({ top: 0 });
}

function saveSettings() {
  const ftp = num($('#set-ftp').value);
  const weight = num($('#set-weight').value);
  const thr = C.parsePace($('#set-thr').value);
  const lthr = num($('#set-lthr').value);
  const hrMax = num($('#set-hrmax').value);
  if (!ftp || !weight || !isFinite(thr) || !lthr || !hrMax) return toast('Bitte alle Werte prüfen (Schwelle als m:ss)');
  app.state.settings = { ftp, weight, thrPace: thr, lthr, hrMax };
  save();
  render();
  toast('Gespeichert – alle Pace-, Watt- und HF-Vorgaben sind neu berechnet');
}

async function doExport() {
  const blob = S.exportBackup(app.state);
  const name = `trainingapp-backup-${today()}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Trainingsapp Backup' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function doImport(file) {
  try {
    const st = await S.readBackup(file);
    if (!confirm('Backup einspielen? Aktuelle Daten auf diesem Gerät werden ersetzt.')) return;
    app.state = st;
    if (app.plan) S.migrateToPlan(app.plan, app.state);
    save();
    render();
    toast('Backup eingespielt ✓');
  } catch (e) {
    toast(`Import fehlgeschlagen: ${e.message}`);
  }
}

// ---------- Drag & Drop (am Griff ⠿ ziehen) ----------
function setupDrag() {
  const view = $('#view');
  let drag = null;
  let scroller = null;

  const begin = (row, x, y) => {
    if (app.tab !== 'week') return;
    const id = row.dataset.id;
    const s = eff().find((q) => q.id === id);
    if (!s || s.cancelled || s.sport === 'race' || app.state.actuals[id]?.done) return;
    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    row.classList.add('dragging');
    drag = { id, row, ghost, from: s.date, dx: x - rect.left, dy: y - rect.top, over: null, x, y };
    moveGhost(x, y);
    navigator.vibrate?.(15);
    // automatisch scrollen, wenn der Finger am oberen/unteren Rand steht
    scroller = setInterval(() => {
      if (!drag || !drag.moved) return;
      const r = view.getBoundingClientRect();
      const step = drag.y < r.top + 40 ? -6 : drag.y > r.bottom - 40 ? 6 : 0;
      if (step) {
        view.scrollBy(0, step);
        moveGhost(drag.x, drag.y);
      }
    }, 16);
  };
  const moveGhost = (x, y) => {
    if (Math.abs(y - drag.y) > 3) drag.moved = true;
    drag.x = x;
    drag.y = y;
    drag.ghost.style.transform = `translate(${x - drag.dx}px, ${y - drag.dy}px)`;
    drag.ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    drag.ghost.style.display = '';
    const day = el?.closest('.day[data-date]');
    if (drag.over && drag.over !== day) drag.over.classList.remove('drop');
    if (day) day.classList.add('drop');
    drag.over = day;
  };
  const end = () => {
    clearInterval(scroller);
    if (!drag) return;
    const { id, row, ghost, over, from } = drag;
    ghost.remove();
    row.classList.remove('dragging');
    over?.classList.remove('drop');
    drag = null;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 350);
    const to = over?.dataset.date;
    if (to && to !== from) openMoveProposal(id, to);
  };

  view.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('[data-grip]');
    if (!grip) return;
    e.preventDefault();
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {}
    begin(grip.closest('.sess[data-id]'), e.clientX, e.clientY);
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
  });
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  // iOS: Scrollen während des Ziehens verhindern
  view.addEventListener('touchmove', (e) => drag && e.preventDefault(), { passive: false });

  // Wischen zum Blättern
  let sw = null;
  view.addEventListener('touchstart', (e) => (sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }), { passive: true });
  view.addEventListener('touchend', (e) => {
    if (!sw || drag || suppressClick) return;
    const dx = e.changedTouches[0].clientX - sw.x;
    const dy = e.changedTouches[0].clientY - sw.y;
    if (Math.abs(dx) > 80 && Math.abs(dy) < 50 && Date.now() - sw.t < 600 && ['week', 'month', 'review'].includes(app.tab)) navigate(app.tab, dx < 0 ? 1 : -1);
    sw = null;
  });
}

// ---------- Plan laden ----------
async function loadPlan(manual) {
  try {
    const plan = await S.fetchPlan();
    const isNew = !app.plan || app.plan.planId !== plan.planId || app.plan.version !== plan.version;
    app.plan = plan;
    const mig = S.migrateToPlan(plan, app.state);
    save();
    if (isNew || manual) render();
    if (mig) toast(`Neuer Plan geladen (Version ${plan.version}). Ist-Werte & Kommentare bleiben erhalten.`, 4000);
    else if (manual) toast('Plan ist aktuell ✓');
  } catch (e) {
    if (!app.plan) $('#view').innerHTML = `<div class="card"><h3>Offline</h3><p>Plan konnte nicht geladen werden. Bitte einmal mit Internet öffnen.</p></div>`;
    else if (manual) toast('Keine Verbindung – Plan bleibt wie er ist');
  }
}

function init() {
  const t = today();
  app.week = C.mondayOf(t);
  app.review = C.mondayOf(t);
  app.month = t.slice(0, 8) + '01';
  if (location.hash === '#review') {
    app.tab = 'review';
    // Sonntagabend → aktuelle Woche, Montag früh → letzte Woche
    if (C.weekday(t) === 0) app.review = C.addDays(C.mondayOf(t), -7);
  } else if (['#week', '#month', '#more'].includes(location.hash)) app.tab = location.hash.slice(1);

  $$('#tabbar button').forEach((b) =>
    b.addEventListener('click', () => {
      app.tab = b.dataset.tab;
      history.replaceState(null, '', `#${app.tab}`);
      render();
      $('#view').scrollTo({ top: 0 });
    }),
  );
  const view = $('#view');
  bindSessionClicks(view);
  view.addEventListener('click', onViewClick);
  view.addEventListener('change', (e) => {
    if (e.target.id === 'import' && e.target.files[0]) doImport(e.target.files[0]);
  });
  view.addEventListener('input', (e) => {
    if (e.target.id === 'week-note') {
      const wn = (app.state.weekNotes[app.review] ||= {});
      wn.text = e.target.value;
      clearTimeout(e.target._t);
      e.target._t = setTimeout(save, 400);
    }
  });
  setupDrag();

  app.plan = S.cachedPlan();
  if (app.plan) {
    S.migrateToPlan(app.plan, app.state);
    render();
  }
  loadPlan(false);
  S.requestPersistence();

  // Beim Zurückkehren in die App: Tag ggf. gewechselt → neu zeichnen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && app.plan) {
      render();
      loadPlan(false);
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const el = $('#toast');
            toast('Update verfügbar – tippen zum Neuladen', 8000);
            el.onclick = () => location.reload();
          }
        });
      });
    });
  }
}

init();
