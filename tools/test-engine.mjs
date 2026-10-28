// Schnelltest der Plan-Logik: node tools/test-engine.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { proposeMove, applyMoves, applyIllness, effectiveSessions, byDate, evaluateWeek, clearTag } from '../js/engine.js';
import { weekDates, DEFAULT_ATHLETE, sessionTotals } from '../js/core.js';

const plan = JSON.parse(readFileSync(new URL('../plan.json', import.meta.url)));
const A = DEFAULT_ATHLETE;
const show = (state, mon) => {
  const m = byDate(effectiveSessions(plan, state));
  for (const d of weekDates(mon)) console.log('  ', d, (m.get(d) || []).map((s) => (s.cancelled ? `[x ${s.title}]` : s.title)).join(' | ') || '— Ruhetag —');
};

// 1) Originalplan ohne Regelverstöße
for (const w of plan.weeks) {
  const m = byDate(plan.sessions);
  const ev = evaluateWeek(weekDates(w.start).map((d) => m.get(d) || []));
  if (ev.issues.length) console.log('Hinweis Plan', w.start, ev.issues);
}

// 2) Dienstag-Qualität auf Montag (Ruhetag) verschieben
const state = { overrides: {}, actuals: {}, illnesses: [] };
const mon = '2027-01-11';
const tue = plan.sessions.find((s) => s.date === '2027-01-12');
const p = proposeMove(plan, state, tue.id, '2027-01-11', '2027-01-01');
console.log('\nVerschiebe', tue.title, '→ Mo. Ohne Anpassung:', p.simple, '\nVorschlag:', p.moves.map((m) => `${m.id}: ${m.from}→${m.to}`), 'Rest:', p.after);
applyMoves(plan, state, p.moves);
show(state, mon);
assert.ok(p.after.length <= p.simple.length);

// 3) Langen Lauf von So auf Sa
const st2 = { overrides: {}, actuals: {}, illnesses: [] };
const sun = plan.sessions.find((s) => s.date === '2027-02-07' && s.long);
const p2 = proposeMove(plan, st2, sun.id, '2027-02-06', '2027-02-01');
console.log('\nLanger Lauf So→Sa. Ohne Anpassung:', p2.simple, 'Rest:', p2.after);
applyMoves(plan, st2, p2.moves);
show(st2, '2027-02-01');

// 4) Krankheit: Fieber 5 Tage
const st3 = { overrides: {}, actuals: {}, illnesses: [] };
const ill = { id: 't1', type: 'fever', start: '2027-01-19', end: '2027-01-23' };
const r = applyIllness(plan, st3, ill, A);
console.log('\nFieber 19.–23.1.:', r);
show(st3, '2027-01-18');
show(st3, '2027-01-25');
clearTag(st3, 'ill:t1');
assert.equal(Object.keys(st3.overrides).length, 0);

// 5) Erkältung 2 Tage
const st4 = { overrides: {}, actuals: {}, illnesses: [] };
console.log('\nErkältung 2.–3.2.:', applyIllness(plan, st4, { id: 't2', type: 'neck', start: '2027-02-02', end: '2027-02-03' }, A));
show(st4, '2027-02-01');

const total = plan.sessions.reduce((a, s) => a + sessionTotals(s, A).min, 0);
console.log('\nGesamtumfang Plan:', Math.round(total / 60), 'h');
console.log('OK');
