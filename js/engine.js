// Plan-Logik: effektiver Plan (Plan + Änderungen), Verschiebe-Optimierung, Krankheit.
import { addDays, mondayOf, weekDates, daysBetween, sessionTotals, isHard, isRunLike, DAY_SHORT } from './core.js';

// ---------- Effektiver Plan ----------
// state.overrides[sessionId] = { date?, cancelled?, cancelReason?, replaced?, modTag?, modNote? }
export function effectiveSessions(plan, state) {
  const ov = state.overrides || {};
  return plan.sessions.map((s) => {
    const o = ov[s.id];
    if (!o) return s;
    const e = o.replaced ? { ...o.replaced, id: s.id, date: s.date, slot: s.slot, original: s } : { ...s };
    if (o.date) {
      e.date = o.date;
      e.movedFrom = s.date;
    }
    if (o.cancelled) {
      e.cancelled = true;
      e.cancelReason = o.cancelReason;
    }
    if (o.modTag) e.modTag = o.modTag;
    if (o.modNote) e.modNote = o.modNote;
    return e;
  });
}

const slotOrder = (s) => (s.slot === 'am' ? 0 : s.slot === 'pm' ? 2 : 1);
export function byDate(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date).push(s);
  }
  for (const list of map.values()) list.sort((a, b) => slotOrder(a) - slotOrder(b) || a.id.localeCompare(b.id));
  return map;
}

export const isDone = (state, id) => !!state.actuals?.[id]?.done;

// ---------- Bewertung einer Woche ----------
// arr: 7 Listen mit Einheiten (Mo..So); ctx: { prevHard, nextHard }
export function evaluateWeek(arr, ctx = {}) {
  let cost = 0;
  const issues = [];
  const active = arr.map((l) => l.filter((s) => !s.cancelled));
  const hard = active.map((l) => l.some(isHard));
  for (let i = 0; i < 7; i++) {
    const prev = i === 0 ? ctx.prevHard : hard[i - 1];
    if (hard[i] && prev) {
      cost += 10;
      issues.push(i === 0 ? 'Mo: harter Tag direkt nach hartem Sonntag' : `${DAY_SHORT[i - 1]}/${DAY_SHORT[i]}: zwei harte Tage hintereinander`);
    }
    const l = active[i];
    const hardRuns = l.filter((s) => isHard(s) && isRunLike(s)).length;
    if (hardRuns > 1) {
      cost += 12;
      issues.push(`${DAY_SHORT[i]}: zwei harte Läufe am selben Tag`);
    }
    if (l.filter(isHard).length > 2) {
      cost += 10;
      issues.push(`${DAY_SHORT[i]}: mehr als zwei harte Einheiten`);
    }
    const runs = l.filter(isRunLike).length;
    if (runs >= 2) cost += 3;
    if (l.length > 3) cost += 3;
    if (l.some((s) => s.sport === 'race') && i > 0 && hard[i - 1]) {
      cost += 20;
      issues.push('Harte Einheit am Tag vor dem Rennen');
    }
  }
  if (hard[6] && ctx.nextHard) {
    cost += 10;
    issues.push('So/Mo: zwei harte Tage hintereinander (Wochenwechsel)');
  }
  if (!active.some((l) => l.length === 0)) {
    cost += 8;
    issues.push('Kein Ruhetag in der Woche');
  }
  return { cost, issues };
}

function permutations(n) {
  const out = [];
  const a = Array.from({ length: n }, (_, i) => i);
  const rec = (k) => {
    if (k === n) return out.push(a.slice());
    for (let i = k; i < n; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      rec(k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  rec(0);
  return out;
}

// ---------- Verschieben ----------
// Liefert einen Vorschlag: Einheit X auf toDate, restliche Woche ggf. umsortiert.
export function proposeMove(plan, state, sessionId, toDate, today) {
  const eff = effectiveSessions(plan, state);
  const X = eff.find((s) => s.id === sessionId);
  if (!X) return null;
  const from = X.date;
  const map = byDate(eff);
  const on = (d) => (map.get(d) || []).filter((s) => s.id !== sessionId);
  const hardOn = (d) => on(d).some(isHard);

  const moves = [{ id: sessionId, from, to: toDate }];
  const weeks = [...new Set([mondayOf(from), mondayOf(toDate)])];
  let before = [];
  let simple = [];
  let after = [];

  for (const mon of weeks) {
    const days = weekDates(mon);
    const locked = (d) => d < today || on(d).some((s) => s.sport === 'race' || isDone(state, s.id));
    const ctx = { prevHard: hardOn(addDays(mon, -1)), nextHard: hardOn(addDays(mon, 7)) };

    // Ausgangslage (vor der Änderung)
    before = before.concat(evaluateWeek(days.map((d) => map.get(d) || []), ctx).issues);

    const unlocked = days.filter((d) => !locked(d));
    // abgesagte Einheiten bleiben stehen und zählen nicht
    const bundles = unlocked.map((d) => on(d).filter((s) => !s.cancelled));
    const fixed = (d) => (locked(d) ? on(d) : on(d).filter((s) => s.cancelled));
    const arrange = (perm) =>
      days.map((d) => {
        const ui = unlocked.indexOf(d);
        const list = [...fixed(d), ...(ui >= 0 ? bundles[perm[ui]] : [])];
        if (d === toDate) list.push(X);
        return list;
      });

    const identity = unlocked.map((_, i) => i);
    const simpleEval = evaluateWeek(arrange(identity), ctx);
    simple = simple.concat(simpleEval.issues);

    let best = { perm: identity, cost: simpleEval.cost, eval: simpleEval };
    if (simpleEval.cost > 0 && unlocked.length > 1) {
      for (const perm of permutations(unlocked.length)) {
        let displaced = 0;
        perm.forEach((p, i) => {
          if (p !== i && bundles[p].length) displaced += bundles[p].some((s) => s.sport === 'gym') ? 1.5 : 1;
        });
        const ev = evaluateWeek(arrange(perm), ctx);
        const cost = ev.cost + displaced;
        if (cost < best.cost) best = { perm, cost, eval: ev };
      }
    }
    after = after.concat(best.eval.issues);
    best.perm.forEach((p, i) => {
      const src = unlocked[p];
      const dst = unlocked[i];
      if (src !== dst) for (const s of bundles[p]) moves.push({ id: s.id, from: src, to: dst });
    });
  }
  return { moves, before: [...new Set(before)], simple: [...new Set(simple)], after: [...new Set(after)], session: X };
}

export function applyMoves(plan, state, moves) {
  const orig = new Map(plan.sessions.map((s) => [s.id, s.date]));
  state.overrides ||= {};
  for (const m of moves) {
    const o = (state.overrides[m.id] ||= {});
    if (orig.get(m.id) === m.to) delete o.date;
    else o.date = m.to;
    if (!Object.keys(o).length) delete state.overrides[m.id];
  }
}

// ---------- Auslassen ----------
export function setSkipped(state, id, skipped) {
  state.overrides ||= {};
  const o = (state.overrides[id] ||= {});
  if (skipped) {
    o.cancelled = true;
    o.cancelReason = 'Ausgelassen';
    o.modTag = o.modTag || 'skip';
  } else if (o.modTag === 'skip') {
    delete o.cancelled;
    delete o.cancelReason;
    delete o.modTag;
  }
  if (!Object.keys(o).length) delete state.overrides[id];
}

// ---------- Krankheit ----------
export const ILLNESS_TYPES = {
  neck: { label: 'Erkältung (nur oberhalb des Halses)', short: 'Erkältung', severe: false },
  fever: { label: 'Fieber / Grippe / Infekt mit Gliederschmerzen', short: 'Fieber/Infekt', severe: true },
  gi: { label: 'Magen-Darm', short: 'Magen-Darm', severe: true },
  injury: { label: 'Verletzung / Schmerzen (kein Laufen)', short: 'Verletzung', severe: false, injury: true },
  other: { label: 'Sonstiges (komplette Pause)', short: 'Sonstiges', severe: true },
};

export function clearTag(state, tag) {
  for (const [id, o] of Object.entries(state.overrides || {})) {
    if (o.modTag !== tag) continue;
    delete o.cancelled;
    delete o.cancelReason;
    delete o.replaced;
    delete o.modTag;
    delete o.modNote;
    if (!Object.keys(o).length) delete state.overrides[id];
  }
}

const round5 = (m) => Math.max(15, Math.round(m / 5) * 5);

function easyVersion(s, factor, a, note, cap = null) {
  const t = sessionTotals(s, a);
  if (s.sport === 'bike') {
    const min = round5(Math.min(t.min * factor, cap ? cap + 15 : 75));
    return { sport: 'bike', title: `Rad locker ${min}' (angepasst)`, load: 'easy', desc: `${note} Statt: ${s.title}.`, steps: [{ t: 'easy', min, pct: [56, 70], label: 'Locker' }] };
  }
  const min = round5(Math.min(t.min * factor, cap || (s.long ? 80 : 50)));
  return { sport: 'run', title: `Lauf locker ${min}' (angepasst)`, load: 'easy', desc: `${note} Statt: ${s.title}.`, steps: [{ t: 'easy', zone: 'E', min, label: 'Locker' }] };
}
function moderateVersion(s, a, note) {
  if (s.sport === 'bike') {
    return { sport: 'bike', title: "Tempo 2× 12' (angepasst)", load: 'moderate', desc: `${note} Statt: ${s.title}.`, steps: [{ t: 'wu', min: 15, pct: [50, 70], label: 'Einfahren' }, { rep: 2, steps: [{ t: 'work', min: 12, pct: [78, 85], label: 'Tempo' }, { t: 'rec', min: 5, pct: [45, 55], label: 'Locker' }] }, { t: 'cd', min: 10, pct: [45, 55], label: 'Ausfahren' }] };
  }
  return { sport: 'run', title: "Steady 20' (angepasst)", load: 'moderate', desc: `${note} Statt: ${s.title}.`, steps: [{ t: 'wu', zone: 'E', km: 3, label: 'Einlaufen' }, { t: 'work', zone: 'S', min: 20, label: 'Steady' }, { t: 'cd', zone: 'E', km: 2, label: 'Auslaufen' }] };
}
function crossVersion(s, a, note) {
  // Verletzung: Laufen durch lockeres Rad ersetzen
  const t = sessionTotals(s, a);
  const min = round5(Math.min(t.min * 1.1, 90));
  return { sport: 'bike', title: `Rad locker ${min}' (statt Lauf)`, load: 'easy', desc: `${note} Statt: ${s.title}. Nur wenn schmerzfrei!`, steps: [{ t: 'easy', min, pct: [56, 72], label: 'Grundlage' }] };
}

// Wendet eine Krankheit auf state.overrides an. Gibt eine Zusammenfassung zurück.
export function applyIllness(plan, state, ill, a) {
  const tag = `ill:${ill.id}`;
  clearTag(state, tag);
  const type = ILLNESS_TYPES[ill.type] || ILLNESS_TYPES.other;
  const days = daysBetween(ill.start, ill.end) + 1;
  const eff = effectiveSessions(plan, state);
  const ov = (state.overrides ||= {});
  const set = (s, patch) => {
    if (isDone(state, s.id) || s.sport === 'race') return false;
    const o = (ov[s.id] ||= {});
    Object.assign(o, patch, { modTag: tag });
    return true;
  };
  const changes = [];
  const label = `Krank (${type.short})`;

  // 1) Während der Krankheit
  for (const s of eff) {
    if (s.date < ill.start || s.date > ill.end || s.cancelled) continue;
    if (type.injury) {
      if (isRunLike(s)) set(s, { replaced: crossVersion(s, a, 'Verletzung:'), modNote: label }) && changes.push(s);
      continue;
    }
    if (type.severe || s.sport === 'gym') {
      set(s, { cancelled: true, cancelReason: label }) && changes.push(s);
    } else {
      set(s, { replaced: easyVersion(s, isHard(s) ? 0.6 : 0.7, a, 'Erkältung: nur locker, max. 45–50 min. Bei Verschlechterung pausieren.'), modNote: label }) && changes.push(s);
    }
  }

  // 2) Wiedereinstieg
  let restAfter = 0;
  let windows;
  if (type.injury) {
    windows = [{ len: 7, mode: 'easy', factor: 0.7, note: 'Wiedereinstieg nach Verletzung: nur locker, schmerzfrei.' }];
  } else if (type.severe) {
    restAfter = ill.type === 'fever' ? 1 : 0;
    windows =
      days <= 3
        ? [{ len: 2, mode: 'easy', factor: 0.9, note: 'Wiedereinstieg: noch keine Intensität.' }]
        : days <= 7
          ? [{ len: 7, mode: 'easy', factor: 0.7, note: 'Wiedereinstieg: eine Woche ohne Intensität, ~70 % Umfang.' }]
          : [
              { len: 7, mode: 'easy', factor: 0.6, note: 'Wiedereinstieg Woche 1: nur locker, ~60 % Umfang.' },
              { len: 7, mode: 'moderate', factor: 0.8, note: 'Wiedereinstieg Woche 2: moderate statt harter Reize, ~80 % Umfang.' },
            ];
  } else {
    windows =
      days <= 3
        ? [{ len: 1, mode: 'easy', factor: 1, note: 'Nach der Erkältung: ein Tag noch locker.' }]
        : days <= 7
          ? [{ len: 4, mode: 'easy', factor: 0.8, note: 'Nach der Erkältung: 4 Tage locker, ~80 % Umfang.' }]
          : [
              { len: 7, mode: 'easy', factor: 0.7, note: 'Wiedereinstieg Woche 1: nur locker.' },
              { len: 7, mode: 'moderate', factor: 0.85, note: 'Wiedereinstieg Woche 2: moderate Reize.' },
            ];
  }

  let cursor = addDays(ill.end, 1);
  const backStart = addDays(cursor, restAfter);
  // erste Tage nach schwerer Krankheit / langer Pause besonders kurz halten
  const capFor = (d) => {
    const i = daysBetween(backStart, d);
    if ((type.severe || days > 7) && i < 2) return 40;
    if (type.severe && days > 3 && i < 7) return 60;
    return null;
  };
  for (let i = 0; i < restAfter; i++) {
    for (const s of eff.filter((x) => x.date === cursor && !x.cancelled)) set(s, { cancelled: true, cancelReason: 'Fieberfrei werden (24 h Pause)' }) && changes.push(s);
    cursor = addDays(cursor, 1);
  }
  for (const w of windows) {
    const end = addDays(cursor, w.len - 1);
    for (const s of eff) {
      if (s.date < cursor || s.date > end || s.cancelled || s.sport === 'gym') continue;
      if (type.injury && isRunLike(s)) {
        set(s, { replaced: easyVersion(s, 0.6, a, w.note), modNote: 'Wiedereinstieg' }) && changes.push(s);
        continue;
      }
      if (w.mode === 'easy' && (isHard(s) || s.load === 'moderate' || w.factor < 1)) {
        set(s, { replaced: easyVersion(s, w.factor, a, w.note, capFor(s.date)), modNote: 'Wiedereinstieg' }) && changes.push(s);
      } else if (w.mode === 'moderate') {
        if (isHard(s) && !s.long) set(s, { replaced: moderateVersion(s, a, w.note), modNote: 'Wiedereinstieg' }) && changes.push(s);
        else if (s.long || w.factor < 1) set(s, { replaced: easyVersion(s, w.factor, a, w.note), modNote: 'Wiedereinstieg' }) && changes.push(s);
      }
    }
    cursor = addDays(end, 1);
  }

  const warnings = [];
  if (days > 10) warnings.push('Längere Pause: Schreib Claude kurz Bescheid – dann werden die Phasen bis zum Rennen neu verteilt.');
  const race = plan.sessions.find((s) => s.sport === 'race' && s.date >= ill.start && s.date <= cursor);
  if (race) warnings.push(`Achtung: ${race.title} liegt im Krankheits-/Wiedereinstiegszeitraum. Start nur, wenn du wieder fit bist.`);
  return { changes: changes.length, until: addDays(cursor, -1), warnings };
}

export function reapplyIllnesses(plan, state, a) {
  for (const ill of state.illnesses || []) clearTag(state, `ill:${ill.id}`);
  for (const ill of [...(state.illnesses || [])].sort((x, y) => x.start.localeCompare(y.start))) applyIllness(plan, state, ill, a);
}

// ---------- Kennzahlen ----------
export function dayStats(list, state, a) {
  const res = { plan: { runKm: 0, bikeMin: 0, min: 0, n: 0 }, ist: { runKm: 0, bikeMin: 0, min: 0, n: 0 } };
  for (const s of list) {
    if (s.cancelled) continue;
    // optionale Einheiten zählen nur, wenn sie gemacht wurden
    if (s.optional && !state.actuals?.[s.id]?.done) continue;
    const t = sessionTotals(s, a);
    res.plan.n++;
    res.plan.min += t.min;
    if (isRunLike(s)) res.plan.runKm += t.km;
    if (s.sport === 'bike') res.plan.bikeMin += t.min;
    const act = state.actuals?.[s.id];
    if (act?.done) {
      res.ist.n++;
      const min = act.min ?? t.min;
      res.ist.min += min;
      if (isRunLike(s)) res.ist.runKm += act.km ?? t.km;
      if (s.sport === 'bike') res.ist.bikeMin += min;
    }
  }
  return res;
}
export function extraStats(extras) {
  const r = { runKm: 0, bikeMin: 0, min: 0, n: 0 };
  for (const e of extras || []) {
    r.n++;
    r.min += e.min || 0;
    if (e.sport === 'run') r.runKm += e.km || 0;
    if (e.sport === 'bike') r.bikeMin += e.min || 0;
  }
  return r;
}
