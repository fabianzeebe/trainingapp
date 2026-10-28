# Trainingsapp

Persönlicher Trainingsplan (Lauf, Rad, Stabi) als Web-App fürs iPhone.
Aktuelles Ziel: **Haspa Marathon Hamburg, 25.04.2027, 2:55:00**.

## Nutzung
- In Safari öffnen → Teilen → **Zum Home-Bildschirm**.
- **Woche / Monat**: Soll-Plan, Häkchen = erledigt (wie geplant). Antippen → Details & Ist-Werte.
- **Verschieben**: Einheit am Griff ⠿ auf einen anderen Tag ziehen (oder in der Einheit „Verschieben“). Die App schlägt eine angepasste Woche vor.
- **Krankheit**: Mehr → Krankheit melden. Einheiten werden abgesagt, der Wiedereinstieg wird automatisch geplant.
- **Bilanz**: Sonntagabend-Abgleich Soll / Ist mit Wochenkommentar.
- **Mehr**: FTP, Gewicht, Schwelle, HF → alle Pace-/Watt-/HF-Vorgaben werden neu berechnet. Backup Export/Import.

Ist-Daten, Kommentare und Änderungen liegen **nur lokal auf dem Gerät** (localStorage). Der Plan selbst liegt in `plan.json`.

## Aufbau
| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | Oberfläche |
| `js/app.js` | UI (Ansichten, Formulare, Drag & Drop) |
| `js/engine.js` | Verschiebe-Logik, Krankheitsregeln, Kennzahlen |
| `js/core.js` | Zonen (Pace / %FTP / HF), Datum, Formatierung |
| `js/store.js` | Speicherung, Plan laden, Backup |
| `sw.js` | Offline-Cache |
| `plan.json` | Generierter Plan |
| `tools/library.mjs` | Trainings-Bibliothek (Lauf, Rad, Gym) |
| `tools/generate-plan.mjs` | Wochenstruktur des Plans → `plan.json` |

## Neues Ziel / Plan ändern
1. `tools/generate-plan.mjs` anpassen (Ziel, Startdatum, Wochen) und `VERSION` erhöhen bzw. neue `PLAN_ID`.
2. `npm run plan` → schreibt `plan.json`. `npm test` prüft die Logik.
3. Committen & pushen. Die App lädt den neuen Plan beim nächsten Öffnen; Ist-Werte und Kommentare bleiben erhalten.

Bei Code-Änderungen `VERSION` in `sw.js` erhöhen, damit das iPhone das Update lädt.
