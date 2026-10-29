# Trainingsapp – Hinweise für Claude

Persönliche Trainings-PWA (GitHub Pages, Branch `main`, öffentlich). Sprache mit dem Athleten: Deutsch.

- Coaching / Ist-Daten aus Strava / Plananpassungen: **zuerst `coach/README.md` lesen** und `coach/log.md` für den bisherigen Verlauf.
- Plan neu erzeugen: `tools/generate-plan.mjs` anpassen, `VERSION` erhöhen, `npm run plan`, `npm test`.
- App-Code (`js/`, `styles.css`, `index.html`) geändert → `VERSION` in `sw.js` erhöhen.
- Commits mit `git -c user.name="fabianzeebe" -c user.email="fabianzeebe@users.noreply.github.com"`.
