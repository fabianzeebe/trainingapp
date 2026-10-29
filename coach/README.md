# Coaching-Ablauf (für Claude)

Athlet: Fabian. Ziel: Haspa Marathon Hamburg, 25.04.2027, 2:55:00 (4:09/km).
Werte: Schwelle Lauf 3:57/km, LTHR 169, HFmax 188, FTP 320 W, 79 kg (4,05 W/kg).
Marathon hat Vorrang, Rad zum Fitnesserhalt/-aufbau, 1× Gym (Stabi) pro Woche, 1 Ruhetag (Mo).

## Datenfluss
- Garmin (Forerunner 255S, Edge 830, weitere Garmin-Geräte) → Garmin Connect → **Strava**. Strava ist die einzige Quelle (Strava-MCP).
- Claude schreibt Ist-Werte, Kommentare und Plananpassungen in **`coach.json`** (über `tools/coach.mjs`), committet und pusht auf `main`.
  Die App lädt `coach.json` beim Öffnen. Einträge, die der Athlet in der App selbst macht, haben Vorrang.
- Das Repository ist **öffentlich** (bewusst so entschieden). Keine sensiblen Details (Gesundheit über Trainingsbezug hinaus, Orte, Dritte) in Kommentare schreiben.

## Täglicher Abgleich (auf Zuruf oder automatisch gegen 21:30)
1. `git pull`, dann `node tools/coach.mjs week <heute>`: Soll der Woche und bereits importierte Einheiten ansehen.
2. Strava: `list_activities` für den Tag (bzw. seit dem letzten Import, siehe `coach/log.md`).
   - **Nicht importieren:** separate „Ausrollen“-Fahrten (Name enthält „Ausrollen“ oder kurze Rad-Aktivität < 25 min direkt nach einer anderen Ausfahrt).
   - Einheiten vor dem Planstart (02.11.2026) nicht importieren.
3. Jede Aktivität einer geplanten Einheit zuordnen (gleiches Datum ±1 Tag, gleiche Sportart; verschobene Einheiten beachten).
   Passt keine → als Zusatzeinheit (`extra`).
4. Für Qualitätseinheiten `get_activity_performance` / Runden ansehen: Pace bzw. Watt und HF **pro Intervall** gegen die Vorgaben.
5. Änderungen als JSON schreiben und mit `node tools/coach.mjs apply <datei>` übernehmen (Format unten). Coach-Kommentar: 1–3 Sätze, konkret (Was war gut, was war zu schnell/langsam, was heißt das für die nächsten Tage).
6. Bewerten, ob die kommenden Tage angepasst werden müssen (Regeln unten). Kleine Anpassungen direkt umsetzen und im Kommentar begründen.
7. `npm test`, committen („Coach: Ist-Daten <Datum>“), pushen. Kurze Zusammenfassung an den Athleten.
8. Sonntags zusätzlich `weekNote` mit Wochenanalyse (Umfang Soll/Ist, Qualität, Ermüdung, Ausblick).

## Anpassungsregeln
**Direkt umsetzen (Athlet hat zugestimmt):** Änderungen innerhalb der nächsten ~7 Tage:
- lockere Einheit deutlich zu hart (Lauf HF Ø > 150 oder Pace schneller als 4:45/km; Rad Ø > 75 % FTP) → nächste Qualität leicht entschärfen (z. B. eine Wiederholung weniger) oder auf locker setzen, wenn auch RPE/Kommentar Ermüdung zeigen.
- Qualität verfehlt (Pace/Watt deutlich unter Soll bei hoher HF, abgebrochen) → nächsten Tag locker sichern, nächste Qualität nicht steigern.
- Qualität deutlich leichter als geplant (HF niedrig, Pace/Watt über Soll) → beobachten; bei 2–3 Wiederholungen Schwelle/FTP-Anpassung **vorschlagen**.
- Ausgefallene Schlüsseleinheit → nicht einfach nachholen; ggf. Inhalte in die nächste passende Qualität integrieren, nie zwei harte Tage hintereinander.
- Deutlich mehr Rad-Volumen/-Intensität als geplant (z. B. Gruppenausfahrt) → folgenden Lauf-Qualitätstag prüfen.

**Erst fragen:** Phasen verschieben, Wochenumfang > ±15 % über mehr als eine Woche ändern, Rennen/Testwettkampf betreffend, Änderung von FTP/Schwelle/Zonen.

## Format für `apply`
```json
[
  { "type": "actual", "sessionId": "2026-11-03-1", "data": {
      "min": 48, "km": 10.1, "pace": 285, "hr": 141, "maxHr": 158, "watts": null, "np": null, "elev": 40,
      "stravaId": "123", "laps": ["1 km 4:50 · HF 132", "…"], "coach": "Kurzkommentar" },
    "log": "03.11. Lauf locker importiert" },
  { "type": "extra", "date": "2026-11-03", "data": { "sport": "bike", "title": "…", "min": 60, "km": 25, "watts": 180, "hr": 120, "stravaId": "456", "coach": "…" } },
  { "type": "note", "date": "2026-11-03", "text": "Tagesnotiz Coach" },
  { "type": "weekNote", "date": "2026-11-08", "text": "Wochenanalyse" },
  { "type": "adjust", "sessionId": "2026-11-05-2", "expr": "BIKE.sweetSpot({ n: 2, block: 10 })", "reason": "…", "log": "…" },
  { "type": "adjust", "sessionId": "2026-11-06-1", "cancel": true, "reason": "…" },
  { "type": "unadjust", "sessionId": "2026-11-05-2" }
]
```
`pace` in Sekunden/km, `min` in Minuten, `km` in km. Für `expr` stehen `RUN`, `BIKE`, `gym` aus `tools/library.mjs` zur Verfügung.
