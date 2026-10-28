// Speicherung auf dem Gerät (localStorage) + Plan laden + Backup.
import { DEFAULT_ATHLETE, todayStr } from './core.js';
import { reapplyIllnesses } from './engine.js';

const KEY = 'trainingapp:state:v1';
const PLAN_KEY = 'trainingapp:plan:v1';

const empty = () => ({
  settings: {}, // FTP, Gewicht, Schwelle … (überschreibt Plan-Werte)
  overrides: {}, // Verschiebungen, Absagen, Anpassungen pro Einheit
  actuals: {}, // Ist-Werte pro Einheit
  extras: {}, // Zusatzeinheiten pro Datum
  notes: {}, // Tageskommentare
  weekNotes: {}, // Wochenkommentare / Abschluss
  illnesses: [],
  planId: null,
  planVersion: null,
});

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}
export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function athleteOf(plan, state) {
  return { ...DEFAULT_ATHLETE, ...(plan?.athlete || {}), ...(state.settings || {}) };
}

export function cachedPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Holt plan.json vom Server. Gibt { plan, updated } zurück.
export async function fetchPlan() {
  const res = await fetch(`plan.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`plan.json: ${res.status}`);
  const plan = await res.json();
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {}
  return plan;
}

// Neuer Plan / neue Version: alte Verschiebungen in der Zukunft verwerfen,
// Ist-Daten & Kommentare behalten, Krankheiten neu anwenden.
export function migrateToPlan(plan, state) {
  if (state.planId === plan.planId && state.planVersion === plan.version) return null;
  const first = state.planId == null;
  const ids = new Set(plan.sessions.map((s) => s.id));
  const today = todayStr();
  let dropped = 0;
  for (const [id, o] of Object.entries(state.overrides)) {
    const keep = ids.has(id) && (id.slice(0, 10) < today || (o.date && o.date < today));
    if (!keep) {
      delete state.overrides[id];
      dropped++;
    }
  }
  state.planId = plan.planId;
  state.planVersion = plan.version;
  reapplyIllnesses(plan, state, athleteOf(plan, state));
  return first ? null : { dropped };
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {}
}

export function exportBackup(state) {
  const data = JSON.stringify({ app: 'trainingapp', exported: new Date().toISOString(), state }, null, 1);
  return new Blob([data], { type: 'application/json' });
}
export async function readBackup(file) {
  const obj = JSON.parse(await file.text());
  if (obj.app !== 'trainingapp' || !obj.state) throw new Error('Keine gültige Trainingsapp-Sicherung');
  return { ...empty(), ...obj.state };
}
