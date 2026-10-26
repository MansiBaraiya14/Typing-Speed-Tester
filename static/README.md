# Quillkey — adaptive typing practice

Python backend (standard library only, SQLite storage) + HTML/CSS/JS frontend. No dependencies to install.

## Run
```
python3 server.py          # needs Python 3.8+
```
Open http://127.0.0.1:8000 (set `PORT=9000` to change the port). Progress is saved to `quillkey.db`; delete that file to reset.

## Files
- `server.py` – HTTP server, JSON API (`/api/text`, `/api/session`, `/api/progress`), text generator, level logic
- `static/index.html` – practice, results and progress views
- `static/style.css` – responsive, light/dark styling
- `static/app.js` – typing engine, live stats, results, dashboard + chart

## How difficulty adapts
Level 1 uses 6 letters (e n i t r l). Finish a session at 95%+ accuracy and 20+ wpm to unlock the next letter;
below 85% accuracy drops one level. Letters you miss most often appear more frequently in generated text.
