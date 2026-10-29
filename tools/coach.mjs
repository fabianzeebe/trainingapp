// Coach-Werkzeug: liest den Plan und pflegt coach.json (Strava-Ist-Werte, Kommentare, Anpassungen).
//
//   node tools/coach.mjs week [YYYY-MM-DD]        Woche (Montag oder beliebiger Tag) mit Soll, Zielen und Coach-Stand
//   node tools/coach.mjs day YYYY-MM-DD           einzelner Tag
//   node tools/coach.mjs apply datei.json         Änderungen übernehmen (Format siehe coach/README.md)
//   node tools/coach.mjs adjust <id> '<expr>' "Begründung"   Einheit ersetzen, z. B. 'RUN.easy({ km: 10 })'
//   node tools/coach.mjs cancel <id> "Begründung"
//   node tools/coach.mjs unadjust <id>            Coach-Anpassung zurücknehmen
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as C from '../js/core.js';
import { effectiveSessions, byDate } from '../js/engine.js';
import { RUN, BIKE, gym } from './library.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8'));
const COACH_FILE = join(ROOT, 'coach.json');
const LOG_FILE = join(ROOT, 'coach', 'log.md');
const A = { ...C.DEFAULT_ATHLETE, ...PLAN.athlete };

const emptyCoach = () => ({ updated: null, actuals: {}, extras: {}, notes: {}, weekNotes: {}, adjustments: {} });
const load = () => (existsSync(COACH_FILE) ? { ...emptyCoach(), ...JSON.parse(readFileSync(COACH_FILE, 'utf8')) } : emptyCoach());
function store(coach) {
  coach.updated = new Date().toISOString();
  writeFileSync(COACH_FILE, JSON.stringify(coach, null, 1) + '\n');
}
const sessionById = (id) => PLAN.sessions.find((s) => s.id === id);

// ---------- Anzeige ----------
function stepText(st, sport) {
  if (st.rep) return `${st.rep}× [${st.steps.map((x) => stepText(x, sport)).join(' + ')}]`;
  const amt = st.km != null ? C.fmtDist(st.km) : C.fmtStepMin(st.min);
  if (sport === 'bike') {
    const w = C.bikeTarget(st.pct, A).watts;
    return `${amt} ${st.label || ''} ${st.pct[0]}–${st.pct[1]}% (${w[0]}–${w[1]} W)`.replace(/\s+/g, ' ');
  }
  const t = C.runTarget(st.zone, A);
  const pace = t?.pace ? ` ${C.fmtPace(t.pace[0])}–${C.fmtPace(t.pace[1])}/km` : t?.effort ? ` (${t.effort})` : '';
  const hr = t?.hr ? ` HF ${t.hr[0] ? `${t.hr[0]}–` : '<'}${t.hr[1]}` : '';
  return `${amt} ${st.label || t?.name || ''}${pace}${hr}`.replace(/\s+/g, ' ');
}
function printDay(d, map, coach) {
  console.log(`\n${C.DAY_SHORT[C.weekday(d)]} ${d}`);
  for (const s of map.get(d) || []) {
    const t = C.sessionTotals(s, A);
    const flags = [s.load, s.long && 'lang', s.optional && 'optional', s.slot, s.cancelled && `ABGESAGT (${s.cancelReason})`, s.modNote && `angepasst: ${s.modNote}`].filter(Boolean).join(', ');
    console.log(`  [${s.id}] ${s.sport} – ${s.title} (${flags}) · ${s.sport === 'run' || s.sport === 'race' ? `${C.fmtKm(t.km)} km · ` : ''}${C.fmtMin(t.min)}`);
    if (s.steps?.length) console.log(`      ${s.steps.map((x) => stepText(x, s.sport)).join(' → ')}`);
    const act = coach.actuals[s.id];
    if (act) console.log(`      IST: ${JSON.stringify({ ...act, laps: act.laps?.length })}`);
  }
  for (const x of coach.extras[d] || []) console.log(`  [Zusatz ${x.id}] ${x.sport} – ${x.title}: ${JSON.stringify({ ...x, laps: x.laps?.length })}`);
  if (coach.notes[d]) console.log(`  Coach-Notiz: ${coach.notes[d]}`);
}
function printWeek(day) {
  const coach = load();
  const map = byDate(effectiveSessions(PLAN, { overrides: {}, coach }));
  const mon = C.mondayOf(day);
  const w = PLAN.weeks.find((x) => x.start === mon);
  console.log(`KW ${C.isoWeek(mon)} ab ${mon} – Phase ${w?.phase ?? '–'}${w?.deload ? ' (Entlastung)' : ''} – Ziel ${w?.runKm ?? '?'} km Lauf, ${w?.bikeH ?? '?'} h Rad`);
  if (w?.focus) console.log(`Fokus: ${w.focus}`);
  for (const d of C.weekDates(mon)) printDay(d, map, coach);
  if (coach.weekNotes[mon]) console.log(`\nWochenanalyse: ${coach.weekNotes[mon]}`);
}

// ---------- Änderungen ----------
function makeSession(expr) {
  return new Function('RUN', 'BIKE', 'gym', `return (${expr});`)(RUN, BIKE, gym);
}
function log(text) {
  if (!text) return;
  appendFileSync(LOG_FILE, `\n- ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC – ${text}`);
}

// Änderungsliste: [{ type: 'actual'|'extra'|'note'|'weekNote'|'adjust'|'unadjust', ... }]
function apply(changes) {
  const coach = load();
  for (const c of changes) {
    switch (c.type) {
      case 'actual': {
        if (!sessionById(c.sessionId)) throw new Error(`Unbekannte Einheit ${c.sessionId}`);
        coach.actuals[c.sessionId] = { done: true, source: 'strava', ...c.data };
        break;
      }
      case 'extra': {
        const list = (coach.extras[c.date] ||= []);
        const entry = { source: 'strava', ...c.data };
        entry.id ||= entry.stravaId ? `s${entry.stravaId}` : `c${Date.now()}`;
        const i = list.findIndex((x) => x.id === entry.id);
        if (i >= 0) list[i] = entry;
        else list.push(entry);
        break;
      }
      case 'note':
        if (c.text) coach.notes[c.date] = c.text;
        else delete coach.notes[c.date];
        break;
      case 'weekNote':
        coach.weekNotes[C.mondayOf(c.date)] = c.text;
        break;
      case 'adjust': {
        if (!sessionById(c.sessionId)) throw new Error(`Unbekannte Einheit ${c.sessionId}`);
        const adj = { modNote: `Coach: ${c.reason}` };
        if (c.expr) adj.replaced = makeSession(c.expr);
        if (c.replaced) adj.replaced = c.replaced;
        if (c.cancel) Object.assign(adj, { cancelled: true, cancelReason: `Coach: ${c.reason}` });
        if (c.date) adj.date = c.date;
        coach.adjustments[c.sessionId] = adj;
        break;
      }
      case 'unadjust':
        delete coach.adjustments[c.sessionId];
        break;
      default:
        throw new Error(`Unbekannter Typ ${c.type}`);
    }
    if (c.log) log(c.log);
  }
  store(coach);
  console.log(`coach.json aktualisiert (${changes.length} Änderungen)`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'week') printWeek(args[0] || C.todayStr());
else if (cmd === 'day') {
  const coach = load();
  printDay(args[0], byDate(effectiveSessions(PLAN, { overrides: {}, coach })), coach);
} else if (cmd === 'apply') apply(JSON.parse(readFileSync(args[0], 'utf8')));
else if (cmd === 'adjust') apply([{ type: 'adjust', sessionId: args[0], expr: args[1], reason: args[2], log: `Anpassung ${args[0]}: ${args[2]}` }]);
else if (cmd === 'cancel') apply([{ type: 'adjust', sessionId: args[0], cancel: true, reason: args[1], log: `Abgesagt ${args[0]}: ${args[1]}` }]);
else if (cmd === 'unadjust') apply([{ type: 'unadjust', sessionId: args[0], log: `Anpassung ${args[0]} zurückgenommen` }]);
else if (cmd === 'init') existsSync(COACH_FILE) ? console.log('coach.json existiert') : store(emptyCoach());
else console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 9).join('\n'));
