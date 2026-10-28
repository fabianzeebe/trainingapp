// Kernfunktionen: Datum, Zonen, Berechnungen, Formatierung.
// Wird von der App (Browser) und vom Plan-Generator (Node) genutzt.

export const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const DAY_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// ---------- Datum (immer lokale Daten als 'YYYY-MM-DD') ----------
const pad = (n) => String(n).padStart(2, '0');
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
export const weekday = (s) => (parseDate(s).getDay() + 6) % 7; // 0 = Montag
export const mondayOf = (s) => addDays(s, -weekday(s));
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export const todayStr = () => fmtDate(new Date());
export function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function isoWeek(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}
export function fmtDayMonth(s) {
  const d = parseDate(s);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
export function fmtLongDate(s) {
  const d = parseDate(s);
  return `${DAY_LONG[weekday(s)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- Pace & Zeit ----------
export function parsePace(str) {
  if (typeof str === 'number') return str;
  const m = String(str).trim().match(/^(\d+):(\d{1,2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
export function fmtPace(sec) {
  if (!isFinite(sec) || sec <= 0) return '–';
  let s = Math.round(sec);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
export function fmtMin(min) {
  if (!isFinite(min) || min <= 0) return '–';
  const m = Math.round(min);
  if (m < 60) return `${m}'`;
  return `${Math.floor(m / 60)}:${pad(m % 60)} h`;
}
export function fmtStepMin(min) {
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (Number.isInteger(min)) return `${min}'`;
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}'${pad(s % 60)}`;
}
export function fmtKm(km, digits = 1) {
  if (!isFinite(km)) return '–';
  return km.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}
export function fmtDist(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${fmtKm(km, 2)} km`;
}

// ---------- Athlet ----------
export const DEFAULT_ATHLETE = { ftp: 320, weight: 79, thrPace: 237, lthr: 169, hrMax: 188 };

// Lauf-Zonen relativ zur Schwellenpace (Faktor auf sec/km) und Schwellen-HF (LTHR)
export const RUN_ZONES = {
  REC: { name: 'Regeneration', f: [1.35, 1.48], hr: [0, 0.82] },
  E: { name: 'Locker', f: [1.22, 1.35], hr: [0.75, 0.86] },
  S: { name: 'Steady', f: [1.11, 1.17], hr: [0.87, 0.92] },
  MP: { name: 'Marathon-Pace', f: [1.042, 1.058], hr: [0.92, 0.96] },
  HM: { name: 'HM-Pace', f: [0.995, 1.015], hr: [0.96, 1.0] },
  T: { name: 'Schwelle', f: [0.99, 1.01], hr: [0.97, 1.01] },
  '10K': { name: '10-km-Pace', f: [0.93, 0.95], hr: [1.0, 1.05] },
  '5K': { name: '5-km-Pace', f: [0.89, 0.91], hr: [1.03, 1.08] },
  R: { name: 'Schnell', f: [0.84, 0.87], hr: null },
  HILL: { name: 'Bergauf', f: null, est: 1.0, hr: null, effort: 'kräftig, ~5-km-Anstrengung' },
  SPRINT: { name: 'Bergsprint', f: null, est: 0.8, hr: null, effort: 'maximal, aufrecht & kraftvoll' },
  STRIDE: { name: 'Steigerung', f: null, est: 0.82, hr: null, effort: 'locker-schnell, nicht sprinten' },
  JOG: { name: 'Trabpause', f: [1.35, 1.6], hr: null },
  WALK: { name: 'Gehpause', f: null, est: 2.4, hr: null, effort: 'gehen / sehr locker' },
};

// Rad-Zonen nach %FTP (nur zur Anzeige)
export const BIKE_ZONES = [
  { name: 'Z1 Regeneration', pct: [0, 55] },
  { name: 'Z2 Grundlage', pct: [56, 75] },
  { name: 'Z3 Tempo', pct: [76, 87] },
  { name: 'Sweet Spot', pct: [88, 94] },
  { name: 'Z4 Schwelle', pct: [95, 105] },
  { name: 'Z5 VO2max', pct: [106, 120] },
  { name: 'Z6 Anaerob', pct: [121, 150] },
];

export function runTarget(zone, a) {
  const z = RUN_ZONES[zone];
  if (!z) return null;
  const pace = z.f ? [a.thrPace * z.f[0], a.thrPace * z.f[1]] : null;
  let hr = null;
  if (z.hr) {
    const lo = Math.round(a.lthr * z.hr[0]);
    const hi = Math.min(a.hrMax, Math.round(a.lthr * z.hr[1]));
    hr = z.hr[0] === 0 ? [0, hi] : [lo, hi];
  }
  return { name: z.name, pace, hr, effort: z.effort };
}
export function bikeTarget(pct, a) {
  const watts = pct.map((p) => Math.round((a.ftp * p) / 100));
  const wkg = watts.map((w) => w / a.weight);
  return { watts, wkg };
}
export function bikeHr(pct, a) {
  // grobe HF-Orientierung Rad (LTHR Rad ~ LTHR Lauf - 5)
  const lt = a.lthr - 5;
  const mid = (pct[0] + pct[1]) / 2;
  if (mid < 56) return [0, Math.round(lt * 0.8)];
  if (mid < 76) return [Math.round(lt * 0.8), Math.round(lt * 0.89)];
  if (mid < 88) return [Math.round(lt * 0.9), Math.round(lt * 0.94)];
  if (mid < 95) return [Math.round(lt * 0.93), Math.round(lt * 0.98)];
  if (mid < 106) return [Math.round(lt * 0.97), Math.round(lt * 1.02)];
  return null;
}

function zonePaceMid(zone, a) {
  const z = RUN_ZONES[zone];
  if (!z) return a.thrPace * 1.28;
  if (z.f) return (a.thrPace * (z.f[0] + z.f[1])) / 2;
  return a.thrPace * (z.est || 1);
}

// Summen eines Schritts / einer Schrittliste
export function stepTotals(steps, sport, a) {
  let min = 0;
  let km = 0;
  for (const st of steps || []) {
    if (st.rep) {
      const t = stepTotals(st.steps, sport, a);
      min += t.min * st.rep;
      km += t.km * st.rep;
      continue;
    }
    if (sport === 'bike') {
      min += st.min || 0;
      continue;
    }
    const p = zonePaceMid(st.zone, a);
    if (st.km != null) {
      km += st.km;
      min += (st.km * p) / 60;
    } else if (st.min != null) {
      min += st.min;
      km += (st.min * 60) / p;
    }
  }
  return { min, km };
}

export function sessionTotals(s, a) {
  if (!s) return { min: 0, km: 0 };
  if (s.sport === 'gym') return { min: s.min || 45, km: 0 };
  if (s.sport === 'race' && s.raceKm) {
    return { min: (s.raceKm * (s.racePace || a.thrPace * 1.05)) / 60, km: s.raceKm };
  }
  const t = stepTotals(s.steps, s.sport, a);
  if (s.sport === 'bike') return { min: t.min, km: 0 };
  return t;
}

export const isHard = (s) => !!s && !s.cancelled && (s.load === 'hard' || s.long || s.sport === 'race');
export const isRunLike = (s) => s.sport === 'run' || s.sport === 'race';

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
