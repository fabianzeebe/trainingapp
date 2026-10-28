// Trainings-Bibliothek: jede Funktion liefert eine Einheit
// { sport, title, load: 'easy'|'moderate'|'hard', long?, desc, steps | exercises }
// Lauf-Schritte: { t, zone, km | min, label? }  Rad-Schritte: { t, min, pct:[lo,hi], cad?, label? }
// Wiederholungen: { rep: n, steps: [...] }

const rep = (n, ...steps) => ({ rep: n, steps });

// ---------- Laufen ----------
const wu = (km = 3) => ({ t: 'wu', zone: 'E', km, label: 'Einlaufen' });
const cd = (km = 2) => ({ t: 'cd', zone: 'E', km, label: 'Auslaufen' });
const run = (zone, o, label) => ({ t: 'work', zone, ...o, ...(label ? { label } : {}) });
const jog = (o) => ({ t: 'rec', zone: 'JOG', ...o, label: 'Trabpause' });
const easyKm = (km, label = 'Locker') => ({ t: 'easy', zone: 'E', km, label });
const strides = (n = 6) => rep(n, run('STRIDE', { min: 1 / 3 }, 'Steigerung 20s'), { t: 'rec', zone: 'WALK', min: 2 / 3, label: 'Gehen/Traben' });

const R = (o) => ({ sport: 'run', ...o });

export const RUN = {
  easy: ({ km = 10, withStrides = false, title } = {}) =>
    R({
      title: title || (withStrides ? 'Lauf locker + Steigerungen' : 'Lauf locker'),
      load: 'easy',
      desc: withStrides
        ? 'Lockerer Dauerlauf im Gesprächstempo. Am Ende 6 Steigerungen über 20s: locker-schnell, saubere Technik, nicht sprinten.'
        : 'Lockerer Dauerlauf im Gesprächstempo. Bewusst langsam, das ist die Basis für alles andere.',
      steps: withStrides ? [easyKm(Math.max(km - 1, 3)), strides(6)] : [easyKm(km)],
    }),
  recovery: ({ km = 6 } = {}) =>
    R({ title: 'Regenerationslauf', load: 'easy', desc: 'Sehr locker, kurz. Nur Durchblutung, kein Training.', steps: [{ t: 'easy', zone: 'REC', km, label: 'Sehr locker' }] }),
  drills: ({ km = 10 } = {}) =>
    R({
      title: 'Lauf locker + Lauf-ABC',
      load: 'easy',
      desc: 'Locker laufen, nach 3 km 10–12 min Lauf-ABC (Skippings, Anfersen, Hopserlauf, Kniehebelauf, Prellsprünge), danach 4 Steigerungen.',
      steps: [easyKm(3), { t: 'work', zone: 'WALK', min: 12, label: 'Lauf-ABC' }, easyKm(Math.max(km - 4, 3)), rep(4, run('STRIDE', { min: 1 / 3 }, 'Steigerung 20s'), { t: 'rec', zone: 'WALK', min: 2 / 3, label: 'Gehen' })],
    }),
  hillSprints: ({ km = 11, n = 8 } = {}) =>
    R({
      title: `Lauf locker + ${n}× Bergsprints`,
      load: 'moderate',
      desc: 'Neuromuskulärer Reiz und Kraft: kurze, maximale Sprints an einem steilen Hügel (6–10 %). Volle Erholung (gehen), Qualität vor Quantität.',
      steps: [easyKm(km - 2), rep(n, run('SPRINT', { min: 1 / 6 }, 'Bergsprint 10s'), { t: 'rec', zone: 'WALK', min: 2, label: 'Gehpause' }), easyKm(1.5, 'Auslaufen')],
    }),
  fartlek1on1: ({ n = 10 } = {}) =>
    R({
      title: `Fahrtspiel ${n}× 1'/1'`,
      load: 'hard',
      desc: 'Lockerer Einstieg in die Intensität: 1 min zügig (≈10-km-Tempo nach Gefühl), 1 min locker traben. Rhythmus finden, nicht verbeißen.',
      steps: [wu(3), rep(n, run('10K', { min: 1 }, 'Zügig'), jog({ min: 1 })), cd(3)],
    }),
  hills60: ({ n = 8 } = {}) =>
    R({
      title: `Bergläufe ${n}× 60s`,
      load: 'hard',
      desc: 'Kraftausdauer für Beine und Laufökonomie. 60s bergauf (4–6 %) kräftig mit hoher Frequenz und Armeinsatz, locker zurück traben.',
      steps: [wu(3), rep(n, run('HILL', { min: 1 }, 'Bergauf'), jog({ min: 1.5 })), cd(3)],
    }),
  hills2min: ({ n = 6, steadyMin = 15 } = {}) =>
    R({
      title: `Bergläufe ${n}× 2' + ${steadyMin}' Steady`,
      load: 'hard',
      desc: 'Lange Bergläufe kontrolliert kräftig, danach ins flache und 15 min Steady laufen – Kraft in Tempo übertragen.',
      steps: [wu(3), rep(n, run('HILL', { min: 2 }, 'Bergauf'), jog({ min: 2 })), run('S', { min: steadyMin }, 'Steady'), cd(2)],
    }),
  progression: ({ e = 5, s = 4, mp = 3 } = {}) =>
    R({
      title: `Progressionslauf ${e + s + mp} km`,
      load: 'hard',
      desc: 'Drei Stufen ohne Pause: locker → steady → Marathon-Pace. Lehrt, am Ende schneller zu werden, wenn die Beine müde sind.',
      steps: [easyKm(e, 'Stufe 1 locker'), run('S', { km: s }, 'Stufe 2 Steady'), run('MP', { km: mp }, 'Stufe 3 Marathon-Pace'), cd(1)],
    }),
  pyramidFartlek: () =>
    R({
      title: "Pyramiden-Fahrtspiel 1-2-3-4-3-2-1'",
      load: 'hard',
      desc: 'Kurze Abschnitte (1–2 min) im 10-km-Tempo, lange (3–4 min) im HM-Tempo. Pause jeweils halb so lang locker traben.',
      steps: [
        wu(3),
        run('10K', { min: 1 }), jog({ min: 0.5 }),
        run('10K', { min: 2 }), jog({ min: 1 }),
        run('HM', { min: 3 }), jog({ min: 1.5 }),
        run('HM', { min: 4 }), jog({ min: 2 }),
        run('HM', { min: 3 }), jog({ min: 1.5 }),
        run('10K', { min: 2 }), jog({ min: 1 }),
        run('10K', { min: 1 }),
        cd(3),
      ],
    }),
  fartlekHm: ({ n = 6, min = 2 } = {}) =>
    R({
      title: `Fahrtspiel ${n}× ${min}' HM-Tempo`,
      load: 'moderate',
      desc: 'Lockeres Fahrtspiel zum Formerhalt: Abschnitte im HM-Tempo, 1 min traben. Kontrolliert, nicht ausbelasten.',
      steps: [wu(3), rep(n, run('HM', { min }, 'HM-Tempo'), jog({ min: 1 })), cd(3)],
    }),
  cruise: ({ n = 5, km = 1, recMin = 1.25 } = {}) =>
    R({
      title: `Cruise Intervals ${n}× ${km < 1 ? km * 1000 + ' m' : km + ' km'}`,
      load: 'hard',
      desc: 'Schwellen-Wiederholungen mit kurzer Trabpause. Locker-hart: Du könntest am Ende noch 1–2 mehr. Nicht schneller als vorgegeben!',
      steps: [wu(3), rep(n, run('T', { km }, 'Schwelle'), jog({ min: recMin })), cd(2.5)],
    }),
  intervals: ({ n = 6, km = 1, zone = '10K', recMin = 2, title } = {}) =>
    R({
      title: title || `${n}× ${km < 1 ? km * 1000 + ' m' : km + ' km'} @ ${zone === '10K' ? '10-km-Pace' : zone === '5K' ? '5-km-Pace' : zone === 'HM' ? 'HM-Pace' : 'Schwelle'}`,
      load: 'hard',
      desc: zone === '10K' || zone === '5K'
        ? 'VO2max-orientierte Intervalle: gleichmäßig, das letzte darf das schnellste sein. Trabpause aktiv halten.'
        : 'Gleichmäßige Wiederholungen an der Schwelle bzw. im HM-Tempo. Rhythmus und Atmung kontrollieren.',
      steps: [wu(3), rep(n, run(zone, { km }), jog({ min: recMin })), cd(2.5)],
    }),
  ladder: () =>
    R({
      title: 'Leiter 400-800-1200-1600-1200-800-400',
      load: 'hard',
      desc: 'Kurze Stücke im 5-km-Tempo, 800/1200 im 10-km-Tempo, 1600 an der Schwelle. Pause: 90s Trab (nach 1600: 2 min).',
      steps: [
        wu(3),
        run('5K', { km: 0.4 }), jog({ min: 1.5 }),
        run('10K', { km: 0.8 }), jog({ min: 1.5 }),
        run('10K', { km: 1.2 }), jog({ min: 1.5 }),
        run('T', { km: 1.6 }), jog({ min: 2 }),
        run('10K', { km: 1.2 }), jog({ min: 1.5 }),
        run('10K', { km: 0.8 }), jog({ min: 1.5 }),
        run('5K', { km: 0.4 }),
        cd(2.5),
      ],
    }),
  wechsel: ({ n = 4 } = {}) =>
    R({
      title: `Wechseltempo ${n}× (1 km 10K / 1 km MP)`,
      load: 'hard',
      desc: 'Ohne Pause: 1 km im 10-km-Tempo, direkt 1 km in Marathon-Pace als „aktive Erholung“. Trainiert Laktat-Abbau unter Last.',
      steps: [wu(3), rep(n, run('10K', { km: 1 }, '10-km-Pace'), run('MP', { km: 1 }, 'Marathon-Pace (Float)')), cd(2)],
    }),
  float: ({ n = 6 } = {}) =>
    R({
      title: `Float ${n}× (1 km HM / 1 km MP)`,
      load: 'hard',
      desc: 'Durchgehend schnell: 1 km HM-Tempo, 1 km Marathon-Pace im Wechsel. Sehr marathonspezifisch – Pace-Gefühl und Ermüdungsresistenz.',
      steps: [wu(3), rep(n, run('HM', { km: 1 }, 'HM-Pace'), run('MP', { km: 1 }, 'Marathon-Pace')), cd(2)],
    }),
  thresholdMix: ({ sets = 3 } = {}) =>
    R({
      title: `${sets}× (2 km Schwelle + 4× 200 m schnell)`,
      load: 'hard',
      desc: 'Kombi: 2 km an der Schwelle, 90s traben, dann 4× 200 m flott (200 m Trab). Satzpause 3 min.',
      steps: [
        wu(3),
        rep(sets, run('T', { km: 2 }, 'Schwelle'), jog({ min: 1.5 }), rep(4, run('5K', { km: 0.2 }, '200 m flott'), jog({ km: 0.2 })), jog({ min: 3 })),
        cd(2),
      ],
    }),
  tempo: ({ km = 8, zone = 'T', title } = {}) =>
    R({
      title: title || `Tempodauerlauf ${km} km`,
      load: 'hard',
      desc: 'Durchgehend an der Schwelle bzw. knapp darunter. Gleichmäßig anlaufen – die zweite Hälfte entscheidet.',
      steps: [wu(3), run(zone, { km }, zone === 'HM' ? 'HM-Pace' : 'Schwelle'), cd(2)],
    }),
  tempoPlus: ({ min = 20, n = 4 } = {}) =>
    R({
      title: `${min}' Schwelle + ${n}× 1 km 10K`,
      load: 'hard',
      desc: 'Erst 20 min an der Schwelle, 3 min traben, dann 1-km-Stücke im 10-km-Tempo auf Vorbelastung (2 min Trab).',
      steps: [wu(3), run('T', { min }, 'Schwelle'), jog({ min: 3 }), rep(n, run('10K', { km: 1 }), jog({ min: 2 })), cd(2)],
    }),
  mpBlocks: ({ n = 3, km = 3, floatKm = 1 } = {}) =>
    R({
      title: `Marathon-Pace ${n}× ${km} km`,
      load: 'hard',
      desc: 'Wettkampftempo verinnerlichen: 4:09/km fühlen, ohne auf die Uhr zu starren. Zwischen den Blöcken steady (nicht traben!).',
      steps: [wu(3), rep(n, run('MP', { km }, 'Marathon-Pace'), run('S', { km: floatKm }, 'Steady')), cd(2)],
    }),
  progression14: () =>
    R({
      title: 'Progressionslauf 14 km (locker → HM)',
      load: 'hard',
      desc: '5 km locker, 5 km steady, 3 km Marathon-Pace, 1 km HM-Pace. Kontrolle bis zum Schluss.',
      steps: [easyKm(5, 'Locker'), run('S', { km: 5 }, 'Steady'), run('MP', { km: 3 }, 'Marathon-Pace'), run('HM', { km: 1 }, 'HM-Pace'), cd(1.5)],
    }),
  steady: ({ min = 30 } = {}) =>
    R({
      title: `Steady-Lauf ${min}'`,
      load: 'moderate',
      desc: 'Zügiger, aber komfortabler Dauerlauf („comfortably hard“ minus eine Stufe). Aerobe Leistungsfähigkeit ohne große Ermüdung.',
      steps: [wu(3), run('S', { min }, 'Steady'), cd(2)],
    }),
  hmSharpen: ({ n = 3 } = {}) =>
    R({
      title: `Locker + ${n}× 1 km HM-Pace`,
      load: 'moderate',
      desc: 'Vorbelastung vor dem Wettkampf: kurz HM-Tempo antesten, Beine wach machen.',
      steps: [easyKm(4), rep(n, run('HM', { km: 1 }, 'HM-Pace'), jog({ min: 2 })), easyKm(2, 'Auslaufen')],
    }),
  mpTune: ({ n = 3, km = 2 } = {}) =>
    R({
      title: `Locker + ${n}× ${km} km MP`,
      load: 'moderate',
      desc: 'Rennwoche: Marathon-Pace abrufen, entspannt und kontrolliert. Nicht schneller!',
      steps: [wu(3), rep(n, run('MP', { km }, 'Marathon-Pace'), jog({ min: 2 })), cd(1.5)],
    }),
  shakeout: ({ km = 5 } = {}) =>
    R({ title: 'Shake-out + Steigerungen', load: 'easy', desc: 'Sehr locker, 3–4 kurze Steigerungen. Beine lockern.', steps: [easyKm(km - 0.5, 'Sehr locker'), rep(4, run('STRIDE', { min: 1 / 4 }, 'Steigerung 15s'), { t: 'rec', zone: 'WALK', min: 1, label: 'Gehen' })] }),

  // --- lange Läufe ---
  long: ({ km = 24, variant = 'easy', mpKm = 0, n = 0, blockKm = 0, steadyMin = 0 } = {}) => {
    const base = { sport: 'run', long: true, load: 'hard' };
    switch (variant) {
      case 'steadyFinish':
        return { ...base, title: `Langer Lauf ${km} km (Steady-Finish)`, desc: `Locker, die letzten ${steadyMin} min steady. Gut verpflegen (Gel/Getränk testen).`, steps: [easyKm(Math.round((km - (steadyMin * 60) / 270) * 2) / 2, 'Locker'), run('S', { min: steadyMin }, 'Steady')] };
      case 'fastFinish':
        return { ...base, title: `Langer Lauf ${km} km, letzte ${mpKm} km MP`, desc: 'Lange locker, dann auf Marathon-Pace beschleunigen. Simuliert die zweite Rennhälfte auf müden Beinen.', steps: [easyKm(km - mpKm), run('MP', { km: mpKm }, 'Marathon-Pace')] };
      case 'progressive':
        return { ...base, title: `Langer Lauf ${km} km progressiv`, desc: 'In drei Dritteln steigern: locker → oberes locker/steady → letztes Viertel Marathon-Pace.', steps: [easyKm(Math.round(km * 0.45), 'Locker'), run('S', { km: Math.round(km * 0.3) }, 'Steady'), run('MP', { km: km - Math.round(km * 0.45) - Math.round(km * 0.3) }, 'Marathon-Pace')] };
      case 'mpBlocks': {
        const fast = n * blockKm + (n - 1) * 1;
        return { ...base, title: `Langer Lauf ${km} km mit ${n}× ${blockKm} km MP`, desc: 'Schlüsseleinheit Marathon: MP-Blöcke im langen Lauf, dazwischen 1 km steady. Rennverpflegung üben (alle 25–30 min).', steps: [easyKm(Math.max(km - fast - 2, 4), 'Locker'), rep(n, run('MP', { km: blockKm }, 'Marathon-Pace'), run('S', { km: 1 }, 'Steady')), easyKm(2, 'Auslaufen')] };
      }
      case 'mpContinuous':
        return { ...base, title: `Langer Lauf ${km} km mit ${mpKm} km MP am Stück`, desc: 'Generalprobe: Schuhe, Verpflegung, Renn-Outfit. Marathon-Pace kontrolliert, nicht schneller.', steps: [easyKm(Math.max(km - mpKm - 2, 4), 'Locker'), run('MP', { km: mpKm }, 'Marathon-Pace'), easyKm(2, 'Auslaufen')] };
      case 'hilly':
        return { ...base, title: `Langer Lauf ${km} km wellig`, desc: 'Locker auf welliger Strecke (Isarhochufer, Perlacher Forst, …). Kraft durch Gelände statt Tempo.', steps: [easyKm(km, 'Locker, wellig')] };
      default:
        return { ...base, title: `Langer Lauf ${km} km`, desc: 'Locker und gleichmäßig. Ab 25 km Verpflegung mitnehmen und üben.', steps: [easyKm(km, 'Locker')] };
    }
  },
  race: ({ title, km, targetPace, desc }) => ({ sport: 'race', title, load: 'hard', raceKm: km, racePace: targetPace, desc, steps: [] }),
};

// ---------- Rad ----------
const bwu = (min = 15) => ({ t: 'wu', min, pct: [50, 70], label: 'Einfahren (steigernd)' });
const bcd = (min = 10) => ({ t: 'cd', min, pct: [45, 55], label: 'Ausfahren' });
const bw = (min, pct, label, cad) => ({ t: 'work', min, pct, ...(label ? { label } : {}), ...(cad ? { cad } : {}) });
const brec = (min, pct = [45, 55]) => ({ t: 'rec', min, pct, label: 'Locker' });
const bz2 = (min, label = 'Grundlage') => ({ t: 'easy', min, pct: [62, 72], label });
const B = (o) => ({ sport: 'bike', ...o });

const fill = (total, used) => Math.max(total - used, 0);

export const BIKE = {
  z2: ({ min = 90, title, outdoor = false } = {}) =>
    B({
      title: title || `Rad Grundlage ${Math.round(min)}'`,
      load: 'easy',
      desc: outdoor
        ? 'Ruhige Grundlage. Bei trockenem Wetter gerne draußen mit dem Gravel – dann nach Gefühl/HF statt exakt Watt.'
        : 'Ruhige Grundlage, gleichmäßig treten, Kadenz 85–95. Locker genug, dass der Lauf am nächsten Tag nicht leidet.',
      steps: [bz2(min)],
    }),
  recovery: ({ min = 45 } = {}) => B({ title: `Rad locker ${min}'`, load: 'easy', desc: 'Aktive Erholung, sehr locker kurbeln.', steps: [{ t: 'easy', min, pct: [45, 58], label: 'Sehr locker' }] }),
  z2Tempo: ({ min = 150, n = 3, block = 15, outdoor = true } = {}) =>
    B({
      title: `Grundlage ${fmtH(min)} mit ${n}× ${block}' Tempo`,
      load: 'moderate',
      desc: `Lange Ausfahrt mit Tempo-Blöcken (Z3) im mittleren Teil. ${outdoor ? 'Draußen möglich, Blöcke auf möglichst flachen Abschnitten.' : ''}`,
      steps: [bz2(30, 'Einfahren / Grundlage'), rep(n, bw(block, [78, 85], 'Tempo'), bz2(10, 'Grundlage')), bz2(fill(min, 30 + n * (block + 10)), 'Grundlage')],
    }),
  cadence: ({ min = 120 } = {}) =>
    B({
      title: `Grundlage ${fmtH(min)} mit Kadenz-Drills`,
      load: 'easy',
      desc: 'Grundlage mit 6× 3 min hoher Trittfrequenz (105–115 rpm) – runder Tritt, lockere Hüfte, hilft auch beim Laufen.',
      steps: [bz2(25, 'Grundlage'), rep(6, bw(3, [65, 75], 'Hohe Kadenz', '105–115 rpm'), bz2(4)), bz2(fill(min, 25 + 42))],
    }),
  sweetSpot: ({ n = 3, block = 12, pct = [88, 92], rec = 5, extra = 0 } = {}) =>
    B({
      title: `Sweet Spot ${n}× ${block}'`,
      load: 'hard',
      desc: 'Sweet Spot: hohe aerobe Last bei moderater Ermüdung. Gleichmäßig treten, Kadenz 85–95.',
      steps: [bwu(15), rep(n, bw(block, pct, 'Sweet Spot'), brec(rec)), ...(extra ? [bz2(extra)] : []), bcd(10)],
    }),
  ssProgressive: ({ n = 3 } = {}) =>
    B({
      title: `Sweet Spot steigend ${n}× (5/5/5')`,
      load: 'hard',
      desc: 'Jeder Block in drei Stufen: 5 min 88 %, 5 min 91 %, 5 min 94 %. 5 min locker zwischen den Blöcken.',
      steps: [bwu(15), rep(n, bw(5, [87, 89], 'Stufe 1'), bw(5, [90, 92], 'Stufe 2'), bw(5, [93, 95], 'Stufe 3'), brec(5)), bcd(10)],
    }),
  strength: ({ n = 5, block = 5 } = {}) =>
    B({
      title: `Kraftausdauer ${n}× ${block}' (niedrige Kadenz)`,
      load: 'hard',
      desc: 'Große Gänge, 55–65 rpm, Oberkörper ruhig. Muskuläre Kraftausdauer – gut kombinierbar mit der Laufvorbereitung.',
      steps: [bwu(15), rep(n, bw(block, [84, 90], 'Kraftausdauer', '55–65 rpm'), brec(4)), bz2(10), bcd(10)],
    }),
  overUnder: ({ sets = 3, reps = 3 } = {}) =>
    B({
      title: `Over-Unders ${sets}× (${reps}× 2'/1')`,
      load: 'hard',
      desc: '2 min knapp unter FTP, 1 min knapp darüber – ohne Pause. Lehrt, Laktat unter Last abzubauen. 6 min locker zwischen den Sätzen.',
      steps: [bwu(15), rep(sets, rep(reps, bw(2, [93, 96], 'Under'), bw(1, [104, 108], 'Over')), brec(6)), bcd(10)],
    }),
  fortyTwenty: ({ sets = 3, setMin = 8 } = {}) =>
    B({
      title: `40/20 ${sets}× ${setMin}'`,
      load: 'hard',
      desc: '40s hart (~120 %), 20s locker – im Satz durchgehend. Hohe VO2-Zeit bei überschaubarer Belastung. 5 min locker zwischen den Sätzen.',
      steps: [bwu(15), rep(sets, rep(Math.round(setMin), bw(2 / 3, [118, 125], '40s hart'), { t: 'rec', min: 1 / 3, pct: [45, 55], label: '20s locker' }), brec(5)), bcd(10)],
    }),
  thirtyThirty: ({ sets = 2, reps = 12 } = {}) =>
    B({
      title: `30/30 ${sets}× ${reps}`,
      load: 'hard',
      desc: '30s ~115 %, 30s locker. Saubere, schnelle Kadenz in den harten Teilen. 6 min locker zwischen den Sätzen.',
      steps: [bwu(15), rep(sets, rep(reps, bw(0.5, [112, 118], '30s hart'), { t: 'rec', min: 0.5, pct: [45, 55], label: '30s locker' }), brec(6)), bcd(10)],
    }),
  vo2: ({ n = 5, block = 4, pct = [108, 113], rec = 4 } = {}) =>
    B({
      title: `VO2max ${n}× ${block}'`,
      load: 'hard',
      desc: 'Harte Intervalle: ab Minute 2 tief atmen, bis zum Ende gleichmäßig halten. Pause aktiv locker.',
      steps: [bwu(15), rep(3, bw(0.5, [110, 120], 'Aktivierung 30s'), brec(1)), rep(n, bw(block, pct, 'VO2max'), brec(rec)), bcd(10)],
    }),
  threshold: ({ n = 2, block = 15, pct = [96, 100], rec = 6 } = {}) =>
    B({
      title: `Schwelle ${n}× ${block}'`,
      load: 'hard',
      desc: 'Klassische FTP-Intervalle. Kontrolliert anfahren, nicht über 100 %.',
      steps: [bwu(15), rep(n, bw(block, pct, 'Schwelle'), brec(rec)), bcd(10)],
    }),
  pyramid: () =>
    B({
      title: "Pyramide 2-4-6-8-6-4-2'",
      load: 'hard',
      desc: 'Kurze Blöcke härter (110 %), lange Blöcke an der Schwelle (98 %). Pause = halbe Blocklänge.',
      steps: [
        bwu(15),
        bw(2, [108, 112]), brec(1), bw(4, [103, 106]), brec(2), bw(6, [98, 101]), brec(3), bw(8, [95, 98]), brec(4),
        bw(6, [98, 101]), brec(3), bw(4, [103, 106]), brec(2), bw(2, [108, 112]),
        bcd(10),
      ],
    }),
  microbursts: ({ sets = 3 } = {}) =>
    B({
      title: `Microbursts ${sets}× 10' (15/15)`,
      load: 'hard',
      desc: '15s ~140 %, 15s ~50 %, 10 min am Stück. Schult die schnelle Kraft, fühlt sich anfangs leicht an, wird hart.',
      steps: [bwu(15), rep(sets, rep(20, bw(0.25, [135, 145], '15s'), { t: 'rec', min: 0.25, pct: [45, 55], label: '15s locker' }), brec(5)), bcd(10)],
    }),
  tempoBlocks: ({ n = 2, block = 20 } = {}) =>
    B({
      title: `Tempo ${n}× ${block}'`,
      load: 'moderate',
      desc: 'Lange Tempo-Blöcke (Z3) – solide aerobe Arbeit ohne die Beine für den Lauf zu zerstören.',
      steps: [bwu(15), rep(n, bw(block, [80, 86], 'Tempo'), brec(5)), bcd(10)],
    }),
  openers: ({ min = 45 } = {}) =>
    B({
      title: `Rad locker ${min}' + Öffner`,
      load: 'easy',
      desc: 'Locker mit 3× 1 min zügig (~105 %), 2 min Pause. Nur aktivieren.',
      steps: [bz2(15, 'Locker'), rep(3, bw(1, [100, 108], 'Öffner'), brec(2)), bz2(min - 24, 'Locker')],
    }),
};

function fmtH(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}:${String(m).padStart(2, '0')} h` : `${h} h`;
}

// ---------- Gym / Stabi ----------
const GYM_PROGRAMS = {
  A: {
    title: 'Stabi A – Rumpf & Hüfte',
    exercises: [
      'Aufwärmen: 5 min Rad/Rudern + Mobility Hüfte',
      'Dead Bug – 3× 10/Seite',
      'Unterarmstütz mit Beinheben – 3× 40s',
      'Seitstütz mit Hüftheben – 3× 12/Seite',
      'Pallof Press (Kabel/Band) – 3× 10/Seite',
      'Glute Bridge einbeinig – 3× 12/Seite',
      'Monster Walk mit Miniband – 3× 15 Schritte/Richtung',
      'Bird Dog mit Halt – 3× 8/Seite',
      'Wadenheben einbeinig – 3× 15/Seite',
    ],
  },
  B: {
    title: 'Stabi B – Einbein-Kraft & Füße',
    exercises: [
      'Aufwärmen: 5 min + Fußgelenk- und Hüftmobilisation',
      'Bulgarian Split Squat – 3× 8/Seite (moderat schwer)',
      'Einbeiniges Kreuzheben (RDL) – 3× 8/Seite',
      'Step-ups auf Box (Knie über Hüfte) – 3× 10/Seite',
      'Exzentrisches Wadenheben (langsam ab) – 3× 12/Seite',
      'Copenhagen Plank (kurzer Hebel) – 3× 20s/Seite',
      'Hip Airplane – 3× 5/Seite',
      'Fußgymnastik: Handtuch greifen, Short Foot – 3× 30s',
    ],
  },
  C: {
    title: 'Stabi C – Athletik & Elastizität',
    exercises: [
      'Aufwärmen: 5 min + Lauf-ABC light',
      'Goblet Squat – 3× 10',
      'Hip Thrust (Langhantel) – 3× 10',
      'Seitliche Ausfallschritte – 3× 8/Seite',
      'Pogo Jumps (Fußgelenk-Sprünge) – 3× 20',
      'Sprung-Ausfallschritte (Split Jumps) – 3× 6/Seite',
      'Nordic Hamstring Curl (assistiert) – 3× 5',
      'Ab-Wheel / Rollout – 3× 8',
      'Seitstütz statisch – 2× 45s/Seite',
    ],
  },
  D: {
    title: 'Stabi D – Rumpf-Zirkel & Balance',
    exercises: [
      'Aufwärmen: 5 min + Mobility',
      'Zirkel 3 Runden, 40s Belastung / 20s Pause:',
      '· Plank Shoulder Taps',
      '· Russian Twist mit Gewicht',
      '· Einbeinstand auf Kissen mit Ballwurf/Armbewegung',
      '· Reverse Crunch',
      '· Seitstütz rechts / links',
      '· Superman / Rückenstrecker',
      '· Clamshells mit Band',
      'Abschluss: Wadenheben auf Stufe 3× 15',
    ],
  },
  L: {
    title: 'Stabi Light – Aktivierung',
    exercises: [
      'Nur leichte Aktivierung, nichts Neues, kein Muskelkater!',
      'Dead Bug – 2× 8/Seite',
      'Seitstütz – 2× 30s/Seite',
      'Glute Bridge – 2× 12',
      'Monster Walk – 2× 10 Schritte',
      'Wadenheben – 2× 12',
      'Mobility Hüfte & Waden 10 min',
    ],
  },
};

export function gym(key = 'A', min = 50) {
  const p = GYM_PROGRAMS[key];
  return {
    sport: 'gym',
    title: p.title,
    load: 'easy',
    min,
    desc: key === 'L' ? 'Kurze Aktivierung im Gym.' : 'Stabi- und Kraftprogramm: saubere Technik, 1–2 Wiederholungen „im Tank“ lassen. Pausen 45–60s.',
    exercises: p.exercises,
  };
}
