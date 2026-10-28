// Erzeugt plan.json für ein Ziel.  Aufruf: node tools/generate-plan.mjs
// Die Wochenstruktur ist bewusst handgeplant (Coach-Logik), Füll-Läufe werden
// automatisch so bemessen, dass der Wochen-Laufumfang erreicht wird.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RUN, BIKE, gym } from './library.mjs';
import { addDays, sessionTotals, DEFAULT_ATHLETE } from '../js/core.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = { ...DEFAULT_ATHLETE };

const PLAN_ID = 'hamburg-2027';
const VERSION = 1;
const START = '2026-11-02';

const PHASES = {
  transition: { name: 'Übergang', color: '#8E8E93' },
  base: { name: 'Base', color: '#2F7DF6' },
  build1: { name: 'Build 1', color: '#22A447' },
  build2: { name: 'Build 2 · Spezifisch', color: '#F08C00' },
  taper: { name: 'Taper', color: '#8B5CF6' },
  race: { name: 'Race', color: '#E5383B' },
  recovery: { name: 'Recovery', color: '#5E8C93' },
};

// Kurzschreibweisen
const rest = [];
const fill = (min, max, o = {}) => ({ ...RUN.easy({ km: min, ...o }), fill: [min, max], fillOpts: o });
const koppel = (min, max) => ({ ...fill(min, max, { title: 'Koppellauf locker' }), desc: 'Direkt nach dem Rad 15–20 Minuten später locker laufen. Gewöhnt die Beine an Lauf auf Vorermüdung.' });
const pm = (s) => ({ ...s, slot: 'pm' });
const am = (s) => ({ ...s, slot: 'am' });

// Wochen: d = [Mo, Di, Mi, Do, Fr, Sa, So]
const WEEKS = [
  // ---------------- Übergang ----------------
  { phase: 'transition', km: 42, focus: 'Erholung nach dem Isartal-HM, locker wieder reinkommen. Rad als Grundlage.', d: [
    rest,
    [fill(9, 11, { withStrides: true }), pm(BIKE.z2({ min: 45 }))],
    [gym('A', 45), BIKE.z2({ min: 60 })],
    [am(fill(7, 9)), pm(BIKE.sweetSpot({ n: 3, block: 10, pct: [86, 90] }))],
    [fill(9, 11)],
    [BIKE.z2({ min: 150, outdoor: true })],
    [RUN.long({ km: 18 })],
  ] },
  // ---------------- Base ----------------
  { phase: 'base', km: 48, focus: 'Aerobe Basis: Laufumfang langsam steigern, erste lockere Fahrtspiele, Rad Sweet Spot.', d: [
    rest,
    [RUN.fartlek1on1({ n: 10 }), pm(BIKE.z2({ min: 45 }))],
    [gym('B'), BIKE.z2({ min: 60 })],
    [am(fill(7, 10)), pm(BIKE.sweetSpot({ n: 3, block: 12, extra: 15 }))],
    [RUN.drills({ km: 10 })],
    [BIKE.z2({ min: 165, outdoor: true })],
    [RUN.long({ km: 20 })],
  ] },
  { phase: 'base', km: 53, focus: 'Kraft über Bergläufe und Kraftausdauer am Rad.', d: [
    rest,
    [RUN.hills60({ n: 8 }), pm(BIKE.z2({ min: 50 }))],
    [gym('C'), BIKE.z2({ min: 60 })],
    [am(fill(8, 10)), pm(BIKE.strength({ n: 5, block: 5 }))],
    [fill(9, 13, { withStrides: true })],
    [BIKE.z2Tempo({ min: 165, n: 3, block: 12 })],
    [RUN.long({ km: 22 })],
  ] },
  { phase: 'base', km: 58, focus: 'Erster Progressionslauf, längere Sweet-Spot-Blöcke.', d: [
    rest,
    [RUN.progression({ e: 5, s: 4, mp: 3 }), pm(BIKE.z2({ min: 50 }))],
    [gym('D'), BIKE.z2({ min: 75 })],
    [am(fill(8, 10)), pm(BIKE.sweetSpot({ n: 2, block: 20, pct: [88, 93] }))],
    [fill(10, 14, { withStrides: true })],
    [BIKE.z2Tempo({ min: 180, n: 2, block: 20 })],
    [RUN.long({ km: 24, variant: 'hilly' })],
  ] },
  { phase: 'base', km: 45, deload: true, focus: 'Entlastungswoche: Umfang runter, Frische holen.', d: [
    rest,
    [RUN.hillSprints({ km: 10, n: 8 })],
    [gym('A', 45), BIKE.z2({ min: 60 })],
    [am(fill(7, 9)), pm(BIKE.tempoBlocks({ n: 2, block: 15 }))],
    [fill(8, 11)],
    [BIKE.z2({ min: 120, outdoor: true })],
    [RUN.long({ km: 18 })],
  ] },
  { phase: 'base', km: 62, focus: 'Fahrtspiel-Pyramide und Over-Unders: Tempowechsel lernen.', d: [
    rest,
    [RUN.pyramidFartlek(), pm(BIKE.z2({ min: 50 }))],
    [gym('B'), BIKE.z2({ min: 60 })],
    [am(fill(8, 11)), pm(BIKE.overUnder({ sets: 3, reps: 3 }))],
    [RUN.drills({ km: 12 })],
    [BIKE.cadence({ min: 165 })],
    [RUN.long({ km: 25 })],
  ] },
  { phase: 'base', km: 66, focus: 'Erste Schwellenreize (Cruise Intervals), 40/20 am Rad, Koppellauf.', d: [
    rest,
    [RUN.cruise({ n: 5, km: 1, recMin: 1.25 }), pm(BIKE.z2({ min: 45 }))],
    [gym('C'), BIKE.z2({ min: 60 })],
    [am(fill(8, 11)), pm(BIKE.fortyTwenty({ sets: 3, setMin: 8 }))],
    [fill(10, 13, { withStrides: true })],
    [BIKE.z2Tempo({ min: 180, n: 3, block: 15 }), koppel(5, 7)],
    [RUN.long({ km: 26, variant: 'steadyFinish', steadyMin: 20 })],
  ] },
  { phase: 'base', km: 70, focus: 'Höchster Base-Umfang. Lange Bergläufe + Steady.', d: [
    rest,
    [RUN.hills2min({ n: 6, steadyMin: 15 }), pm(BIKE.z2({ min: 45 }))],
    [gym('D'), BIKE.z2({ min: 75 })],
    [am(fill(9, 12)), pm(BIKE.ssProgressive({ n: 3 }))],
    [fill(10, 14, { withStrides: true })],
    [BIKE.z2({ min: 180, outdoor: true }), koppel(5, 8)],
    [RUN.long({ km: 28 })],
  ] },
  { phase: 'base', km: 55, deload: true, focus: 'Entlastung über die Feiertage. Lockeres HM-Fahrtspiel, Rad-Schwelle als Formcheck.', d: [
    rest,
    [RUN.fartlekHm({ n: 6, min: 2 })],
    [gym('A', 45), BIKE.z2({ min: 60 })],
    [am(fill(8, 10)), pm(BIKE.threshold({ n: 4, block: 8, pct: [97, 102], rec: 4 }))],
    [fill(9, 12)],
    [BIKE.z2({ min: 120, outdoor: true })],
    [RUN.long({ km: 22, variant: 'hilly' })],
  ] },
  // ---------------- Build 1 ----------------
  { phase: 'build1', km: 68, focus: 'Start Build: 2 Lauf-Qualitäten pro Woche, Rad-Qualität nach dem Lauf-Schlüsseltag (Doppeltag).', d: [
    rest,
    [RUN.intervals({ n: 6, km: 1, zone: '10K', recMin: 2 })],
    [gym('B'), BIKE.z2({ min: 60 })],
    [RUN.tempo({ km: 8, zone: 'T' }), pm(BIKE.sweetSpot({ n: 4, block: 10, rec: 4 }))],
    [fill(10, 13, { withStrides: true })],
    [fill(8, 10), pm(BIKE.z2({ min: 120, outdoor: true }))],
    [RUN.long({ km: 26 })],
  ] },
  { phase: 'build1', km: 74, focus: 'Schwelle in längeren Stücken, erste Marathon-Pace-Blöcke.', d: [
    rest,
    [RUN.intervals({ n: 4, km: 2, zone: 'T', recMin: 1.5 })],
    [gym('C'), BIKE.z2({ min: 60 })],
    [RUN.mpBlocks({ n: 3, km: 3 }), pm(BIKE.vo2({ n: 5, block: 4 }))],
    [fill(10, 13)],
    [fill(9, 12, { withStrides: true }), pm(BIKE.z2({ min: 105 }))],
    [RUN.long({ km: 28, variant: 'fastFinish', mpKm: 5 })],
  ] },
  { phase: 'build1', km: 78, focus: 'Leiter-Intervalle, 14-km-Progression, 30 km locker.', d: [
    rest,
    [RUN.ladder()],
    [gym('D'), BIKE.z2({ min: 60 })],
    [RUN.progression14(), pm(BIKE.thirtyThirty({ sets: 2, reps: 12 }))],
    [fill(10, 14, { withStrides: true })],
    [fill(9, 12), pm(BIKE.z2({ min: 120, outdoor: true }))],
    [RUN.long({ km: 30 })],
  ] },
  { phase: 'build1', km: 58, deload: true, focus: 'Entlastungswoche. Kurze schnelle 400er halten die Spritzigkeit.', d: [
    rest,
    [RUN.intervals({ n: 8, km: 0.4, zone: '5K', recMin: 1.5 })],
    [gym('A', 45), BIKE.z2({ min: 60 })],
    [RUN.steady({ min: 30 }), pm(BIKE.recovery({ min: 45 }))],
    [fill(9, 12)],
    [fill(7, 10), pm(BIKE.z2({ min: 120, outdoor: true }))],
    [RUN.long({ km: 22 })],
  ] },
  { phase: 'build1', km: 80, focus: '3× 3 km Schwelle, Schwelle + 10K-Mix, erster langer Lauf mit MP-Blöcken.', d: [
    rest,
    [RUN.intervals({ n: 3, km: 3, zone: 'T', recMin: 2 })],
    [gym('B'), BIKE.z2({ min: 60 })],
    [RUN.tempoPlus({ min: 20, n: 4 }), pm(BIKE.sweetSpot({ n: 3, block: 12 }))],
    [fill(10, 14, { withStrides: true })],
    [fill(9, 12), pm(BIKE.z2({ min: 105 }))],
    [RUN.long({ km: 30, variant: 'mpBlocks', n: 3, blockKm: 4 })],
  ] },
  { phase: 'build1', km: 84, focus: 'VO2-Reiz über 1200er, MP 2× 5 km, langer welliger Lauf.', d: [
    rest,
    [RUN.intervals({ n: 5, km: 1.2, zone: '10K', recMin: 2.5 })],
    [gym('C'), BIKE.z2({ min: 60 })],
    [RUN.mpBlocks({ n: 2, km: 5 }), pm(BIKE.fortyTwenty({ sets: 3, setMin: 8 }))],
    [fill(11, 14, { withStrides: true })],
    [fill(9, 12), pm(BIKE.z2({ min: 120, outdoor: true }))],
    [RUN.long({ km: 32, variant: 'hilly' })],
  ] },
  { phase: 'build1', km: 86, focus: 'Wechseltempo und 10 km im HM-Tempo – härteste Build-1-Woche.', d: [
    rest,
    [RUN.wechsel({ n: 4 })],
    [gym('D'), BIKE.z2({ min: 60 })],
    [RUN.tempo({ km: 10, zone: 'HM', title: 'Tempodauerlauf 10 km (HM-Pace)' }), pm(BIKE.overUnder({ sets: 2, reps: 3 }))],
    [fill(11, 14)],
    [fill(9, 12, { withStrides: true }), pm(BIKE.z2({ min: 105 }))],
    [RUN.long({ km: 30, variant: 'mpBlocks', n: 2, blockKm: 6 })],
  ] },
  { phase: 'build1', km: 64, deload: true, focus: 'Entlastung vor der spezifischen Phase.', d: [
    rest,
    [RUN.hills60({ n: 10 })],
    [gym('A', 45), BIKE.z2({ min: 60 })],
    [RUN.steady({ min: 35 }), pm(BIKE.recovery({ min: 45 }))],
    [fill(10, 13)],
    [fill(8, 11), pm(BIKE.z2({ min: 120, outdoor: true }))],
    [RUN.long({ km: 24 })],
  ] },
  // ---------------- Build 2 / spezifisch ----------------
  { phase: 'build2', km: 86, focus: 'Marathonspezifisch: HM-Pace-Intervalle, Float-Lauf, 32 km mit 3× 5 km MP.', d: [
    rest,
    [RUN.intervals({ n: 5, km: 2, zone: 'HM', recMin: 2 })],
    [gym('B'), BIKE.z2({ min: 60 })],
    [RUN.float({ n: 6 }), pm(BIKE.tempoBlocks({ n: 2, block: 20 }))],
    [fill(10, 14, { withStrides: true })],
    [fill(9, 12), pm(BIKE.z2({ min: 105 }))],
    [RUN.long({ km: 32, variant: 'mpBlocks', n: 3, blockKm: 5 })],
  ] },
  { phase: 'build2', km: 52, focus: 'HM-Formtest am Sonntag (14.03.). Ziel: unter 1:22 (≈3:53/km). Woche leicht reduziert.', d: [
    rest,
    [RUN.thresholdMix({ sets: 2 })],
    [gym('L', 30), BIKE.z2({ min: 60 })],
    [RUN.hmSharpen({ n: 3 })],
    [fill(7, 9)],
    [RUN.shakeout({ km: 5 })],
    [RUN.race({ title: 'Halbmarathon – Formtest', km: 21.0975, targetPace: 232, desc: 'Ziel unter 1:22 (3:53/km). Erste 5 km kontrolliert auf ~3:55, ab km 15 laufen lassen. 3 km einlaufen + Steigerungen vorher. Danach: wie fühlt sich 4:09 im Vergleich an?' })],
  ] },
  { phase: 'build2', km: 74, focus: 'Erholung nach dem HM (Di/Mi locker), dann zurück in die Spezifik.', d: [
    rest,
    [RUN.recovery({ km: 8 })],
    [gym('A', 45), BIKE.z2({ min: 60 })],
    [RUN.mpBlocks({ n: 2, km: 6 }), pm(BIKE.pyramid())],
    [fill(10, 13, { withStrides: true })],
    [fill(9, 12), pm(BIKE.z2({ min: 120, outdoor: true }))],
    [RUN.long({ km: 30, variant: 'progressive' })],
  ] },
  { phase: 'build2', km: 90, focus: 'Spitzenwoche: 4× 3 km Schwelle, 34 km mit 2× 8 km MP.', d: [
    rest,
    [RUN.intervals({ n: 4, km: 3, zone: 'T', recMin: 2 })],
    [gym('C'), BIKE.z2({ min: 60 })],
    [RUN.tempoPlus({ min: 25, n: 3 }), pm(BIKE.fortyTwenty({ sets: 2, setMin: 8 }))],
    [fill(11, 14, { withStrides: true })],
    [fill(9, 12), pm(BIKE.z2({ min: 90 }))],
    [RUN.long({ km: 34, variant: 'mpBlocks', n: 2, blockKm: 8 })],
  ] },
  { phase: 'build2', km: 88, focus: 'Letzte große Woche: Generalprobe 32 km mit 18 km MP am Stück (3 Wochen vor dem Rennen).', d: [
    rest,
    [RUN.cruise({ n: 6, km: 1.6, recMin: 1 })],
    [gym('D'), BIKE.z2({ min: 60 })],
    [RUN.steady({ min: 40 }), pm(BIKE.vo2({ n: 5, block: 3, pct: [112, 118], rec: 3 }))],
    [fill(11, 14, { withStrides: true })],
    [fill(9, 12), pm(BIKE.z2({ min: 90 }))],
    [RUN.long({ km: 32, variant: 'mpContinuous', mpKm: 18 })],
  ] },
  // ---------------- Taper ----------------
  { phase: 'taper', km: 72, focus: 'Taper Woche 1: Umfang ~80 %, Intensität bleibt.', d: [
    rest,
    [RUN.intervals({ n: 5, km: 2, zone: 'T', recMin: 1.5 })],
    [gym('B', 45), BIKE.z2({ min: 60 })],
    [RUN.mpBlocks({ n: 3, km: 3 })],
    [fill(8, 11, { withStrides: true })],
    [fill(6, 9), pm(BIKE.z2({ min: 90 }))],
    [RUN.long({ km: 24, variant: 'mpContinuous', mpKm: 10 })],
  ] },
  { phase: 'taper', km: 56, focus: 'Taper Woche 2: Umfang ~65 %, kurze schnelle Reize, Beine frisch werden lassen.', d: [
    rest,
    [RUN.intervals({ n: 6, km: 1, zone: '10K', recMin: 2 })],
    [gym('L', 30), BIKE.z2({ min: 60 })],
    [RUN.mpBlocks({ n: 2, km: 4 })],
    [fill(7, 9, { withStrides: true })],
    [fill(5, 8), pm(BIKE.openers({ min: 60 }))],
    [RUN.long({ km: 18, variant: 'fastFinish', mpKm: 4 })],
  ] },
  // ---------------- Race ----------------
  { phase: 'race', km: 70, focus: 'Rennwoche Hamburg! Wenig Umfang, MP kurz abrufen, viel schlafen, Kohlenhydrate ab Donnerstag hoch.', d: [
    rest,
    [RUN.mpTune({ n: 3, km: 2 })],
    [gym('L', 25), BIKE.recovery({ min: 45 })],
    [RUN.easy({ km: 8, withStrides: true })],
    [RUN.recovery({ km: 5 })],
    [RUN.shakeout({ km: 5 })],
    [RUN.race({ title: 'Haspa Marathon Hamburg 🏁', km: 42.195, targetPace: 249, desc: 'Ziel 2:55:00 = 4:09/km. Erste Hälfte 1:27:30 (eher 4:10), nicht von der Euphorie mitreißen lassen. Gels alle 25–30 min. Ab km 30 wird gelaufen!' })],
  ] },
  // ---------------- Recovery ----------------
  { phase: 'recovery', km: 14, focus: 'Erholung nach dem Marathon. Nur nach Lust und Laune, alles sehr locker.', d: [
    rest,
    [BIKE.recovery({ min: 45 })],
    [gym('L', 30)],
    [RUN.recovery({ km: 6 })],
    [BIKE.z2({ min: 60 })],
    [RUN.recovery({ km: 8 })],
    [BIKE.z2({ min: 90, outdoor: true })],
  ] },
  { phase: 'recovery', km: 40, focus: 'Langsam zurück. Danach: neues Ziel mit Claude besprechen!', d: [
    rest,
    [fill(8, 10)],
    [gym('A', 45), BIKE.z2({ min: 60 })],
    [fill(9, 11, { withStrides: true })],
    [BIKE.z2({ min: 75 })],
    [fill(8, 10)],
    [RUN.long({ km: 16 })],
  ] },
];

// ---------- Füll-Läufe bemessen ----------
function sizeFills(week) {
  const all = week.d.flat();
  const fills = all.filter((s) => s.fill);
  const fixedKm = all.filter((s) => !s.fill && (s.sport === 'run' || s.sport === 'race')).reduce((a, s) => a + sessionTotals(s, A).km, 0);
  let rem = week.km - fixedKm;
  const kms = fills.map((f) => f.fill[0]);
  // gleichmäßig verteilen innerhalb [min,max]
  let left = rem - kms.reduce((a, b) => a + b, 0);
  for (let guard = 0; left > 0.25 && guard < 200; guard++) {
    let progressed = false;
    for (let i = 0; i < fills.length && left > 0.25; i++) {
      if (kms[i] < fills[i].fill[1]) {
        kms[i] += 0.5;
        left -= 0.5;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  fills.forEach((f, i) => {
    const km = Math.round(kms[i] * 2) / 2;
    const slot = f.slot;
    const fresh = f.fillOpts.title === 'Koppellauf locker' ? { ...RUN.easy({ km, title: 'Koppellauf locker' }), desc: f.desc } : RUN.easy({ km, ...f.fillOpts });
    Object.keys(f).forEach((k) => delete f[k]);
    Object.assign(f, fresh, slot ? { slot } : {});
  });
}

// ---------- Plan zusammenbauen ----------
const sessions = [];
const weeks = [];
WEEKS.forEach((wk, wi) => {
  const monday = addDays(START, wi * 7);
  sizeFills(wk);
  wk.d.forEach((day, di) => {
    const date = addDays(monday, di);
    day.forEach((s, si) => {
      sessions.push({ id: `${date}-${si + 1}`, date, ...s });
    });
  });
  const runKm = wk.d.flat().filter((s) => s.sport === 'run' || s.sport === 'race').reduce((a, s) => a + sessionTotals(s, A).km, 0);
  const bikeMin = wk.d.flat().filter((s) => s.sport === 'bike').reduce((a, s) => a + sessionTotals(s, A).min, 0);
  weeks.push({ start: monday, phase: wk.phase, deload: !!wk.deload, focus: wk.focus, runKm: Math.round(runKm), bikeH: +(bikeMin / 60).toFixed(1) });
});

// Phasen-Zeiträume
const phases = [];
for (const w of weeks) {
  const last = phases[phases.length - 1];
  if (last && last.key === w.phase) last.end = addDays(w.start, 6);
  else phases.push({ key: w.phase, ...PHASES[w.phase], start: w.start, end: addDays(w.start, 6) });
}

const plan = {
  planId: PLAN_ID,
  version: VERSION,
  generated: new Date().toISOString().slice(0, 10),
  goal: { name: 'Haspa Marathon Hamburg', date: '2027-04-25', target: '2:55:00', targetPace: 249 },
  athlete: A,
  phases,
  weeks,
  sessions,
};

writeFileSync(join(ROOT, 'plan.json'), JSON.stringify(plan, null, 1));
console.log(`plan.json: ${sessions.length} Einheiten, ${weeks.length} Wochen`);
for (const w of weeks) console.log(w.start, w.phase.padEnd(10), String(w.runKm).padStart(3), 'km', String(w.bikeH).padStart(4), 'h Rad', w.deload ? '(Entlastung)' : '');
