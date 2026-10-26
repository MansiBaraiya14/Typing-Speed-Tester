"""Quillkey backend: stdlib-only (http.server + sqlite3). Run: python3 server.py"""
import json, os, random, sqlite3, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, "quillkey.db")
ORDER = "enitrlsauodychgmpbkvwfzxqj"   # letters unlock in roughly frequency order
START = 6                              # letters available at level 0
VOWELS = set("aeiouy")
# Use ./static if it holds the site; otherwise accept a flat folder with all files together.
WEB_DIR = os.path.join(ROOT, "static")
if not os.path.exists(os.path.join(WEB_DIR, "index.html")):
    WEB_DIR = ROOT

def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def init():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY, ts INT, wpm REAL, acc REAL,
            errors INT, secs REAL, chars INT, level INT);
        CREATE TABLE IF NOT EXISTS keys(ch TEXT PRIMARY KEY, hits INT, misses INT);
        CREATE TABLE IF NOT EXISTS state(k TEXT PRIMARY KEY, v TEXT);""")

def level():
    with db() as c:
        r = c.execute("SELECT v FROM state WHERE k='level'").fetchone()
    return int(r[0]) if r else 0

def make_text(n):
    """Pseudo-words from unlocked letters; letters the user misses most appear more often."""
    lv = level()
    letters = ORDER[:START + lv]
    with db() as c:
        rows = {r["ch"]: r for r in c.execute("SELECT * FROM keys")}
    weight = {}
    for i, ch in enumerate(letters):
        r = rows.get(ch)
        miss = r["misses"] / max(1, r["hits"] + r["misses"]) if r else 0
        newest = 2 if (i == len(letters) - 1 and lv > 0) else 0
        weight[ch] = 1 + 8 * miss + newest
    vow = [l for l in letters if l in VOWELS]
    con = [l for l in letters if l not in VOWELS] or vow
    words, total = [], 0
    while total < n:
        length = random.randint(3, min(8, 5 + lv // 4))
        word, v = "", random.random() < 0.4
        for _ in range(length):
            pool = vow if v else con
            word += random.choices(pool, [weight[x] for x in pool])[0]
            v = (not v) if random.random() < 0.75 else v
        words.append(word)
        total += len(word) + 1
    return {"text": " ".join(words), "level": lv, "letters": letters, "newest": letters[-1]}

def save(d):
    def num(k, lo, hi):
        return max(lo, min(hi, float(d[k])))
    wpm, acc, secs = num("wpm", 0, 400), num("acc", 0, 100), num("secs", 0, 3600)
    err, chars, lv = int(num("errors", 0, 10000)), int(num("chars", 0, 10000)), level()
    top = len(ORDER) - START
    with db() as c:
        prev = [r[0] for r in c.execute("SELECT wpm FROM sessions")]
        c.execute("INSERT INTO sessions(ts,wpm,acc,errors,secs,chars,level) VALUES(?,?,?,?,?,?,?)",
                  (int(time.time()), wpm, acc, err, secs, chars, lv))
        for k, (h, m) in (d.get("keys") or {}).items():
            if len(k) == 1 and k.isalpha():
                c.execute("INSERT INTO keys VALUES(?,?,?) ON CONFLICT(ch) DO UPDATE "
                          "SET hits=hits+?, misses=misses+?", (k, int(h), int(m), int(h), int(m)))
        new = lv
        if acc >= 95 and wpm >= 20 and lv < top:   # clean and quick: unlock a letter
            new = lv + 1
        elif acc < 85 and lv > 0:                   # struggling: step back
            new = lv - 1
        c.execute("INSERT OR REPLACE INTO state VALUES('level',?)", (str(new),))
    return {"level": new, "change": "up" if new > lv else "down" if new < lv else "",
            "letter": ORDER[START + new - 1] if new > lv else "",
            "best": not prev or wpm > max(prev), "avg": sum(prev) / len(prev) if prev else None}

def progress():
    with db() as c:
        ss = [dict(r) for r in c.execute(
            "SELECT ts,wpm,acc,errors,secs,chars,level FROM sessions ORDER BY id DESC LIMIT 100")][::-1]
        ks = {r["ch"]: [r["hits"], r["misses"]] for r in c.execute("SELECT * FROM keys")}
        n, secs = c.execute("SELECT COUNT(*), COALESCE(SUM(secs),0) FROM sessions").fetchone()
    lv = level()
    return {"sessions": ss, "keys": ks, "level": lv, "order": ORDER,
            "unlocked": START + lv, "count": n, "secs": secs}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=WEB_DIR, **k)
    def log_message(self, fmt, *a):
        print("  " + fmt % a)
    def reply(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/text":
            try: n = int(parse_qs(u.query).get("chars", ["140"])[0])
            except ValueError: n = 140
            self.reply(make_text(min(max(n, 40), 400)))
        elif u.path == "/api/progress":
            self.reply(progress())
        elif u.path.endswith((".py", ".db")):
            self.send_error(404)
        else:
            super().do_GET()
    def do_POST(self):
        if urlparse(self.path).path != "/api/session":
            return self.reply({"error": "not found"}, 404)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            self.reply(save(body))
        except (ValueError, TypeError, KeyError):
            self.reply({"error": "bad request"}, 400)

if __name__ == "__main__":
    init()
    if not os.path.exists(os.path.join(WEB_DIR, "index.html")):
        raise SystemExit("index.html not found. Put index.html, style.css and app.js next to server.py "
                         "(or inside a 'static' folder there).")
    print("Serving site from:", WEB_DIR)
    for f in ("index.html", "style.css", "app.js"):
        print("  ", f, "OK" if os.path.exists(os.path.join(WEB_DIR, f)) else "MISSING")
    port = int(os.environ.get("PORT", 8000))
    print(f"Quillkey running at http://127.0.0.1:{port}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
