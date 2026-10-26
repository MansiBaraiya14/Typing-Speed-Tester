# Quillkey

An adaptive typing practice site. Python backend, plain HTML/CSS/JS frontend, SQLite for saved progress. No dependencies.

## Run
1. Install Python 3.8+.
2. Keep `server.py` with the site files (`index.html`, `style.css`, `app.js`), either in the same folder or inside a `static/` subfolder.
3. From that folder, run `python server.py` (or `python3 server.py` on Mac/Linux).
4. Open http://127.0.0.1:8000. To use another port: `PORT=9000 python3 server.py` (Windows: `set PORT=9000` first).

Progress is stored in `quillkey.db`. Delete it to reset.

## Features
- Typing screen with the current character highlighted and live WPM, accuracy, errors and time
- Adaptive practice text: starts with 6 letters, unlocks more as you improve, and shows your weak letters more often
- Results screen with session stats, personal-best flag and a practice-again button
- Progress dashboard with a WPM chart, summary cards and a per-letter accuracy map
- Responsive layout with light and dark themes

## Levels
Level 1 uses the letters e n i t r l. A session at 95%+ accuracy and 20+ WPM unlocks the next letter. Below 85% accuracy drops one level.

## Files
- `server.py`: web server, API (`/api/text`, `/api/session`, `/api/progress`), text generator, level logic
- `index.html`: practice, results and progress views
- `style.css`: styling
- `app.js`: typing engine, stats, results and dashboard
