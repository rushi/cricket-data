#!/usr/bin/env bash
# Assemble the static site into _site/: the SQLite db, landing page,
# custom theme, and a pinned copy of Datasette Lite.
set -euo pipefail

LITE_COMMIT=779b2d4da76a5dc2f1d9aea0d7c8d854f6e1497b

rm -rf _site
mkdir -p _site/lite

./build.sh
cp cricket.db index.html custom.css metadata.json favicon.svg _site/

# Fill the {{tokens}} in index.html with live numbers from the db
python3 - <<'EOF'
import os, sqlite3
from pathlib import Path

db = sqlite3.connect("cricket.db")
counts = {t: db.execute(f"select count(*) from {t}").fetchone()[0]
          for t in ("players", "stats", "teams", "countries", "formats")}
size_mb = os.path.getsize("cricket.db") / 1e6

tokens = {
    "{{total_rows}}": f"{sum(counts.values()):,}",
    "{{db_size}}": f"{size_mb:.1f} MB",
    **{f"{{{{{t}_rows}}}}": f"{n:,}" for t, n in counts.items()},
}

p = Path("_site/index.html")
html = p.read_text()
for token, value in tokens.items():
    assert token in html, f"{token} not found in index.html"
    html = html.replace(token, value)
p.write_text(html)
EOF

for f in index.html app.css webworker.js; do
  curl -sfL "https://raw.githubusercontent.com/simonw/datasette-lite/$LITE_COMMIT/$f" -o "_site/lite/$f"
done

# Inject our theme after Datasette Lite's own stylesheet
python3 - <<'EOF'
from pathlib import Path
p = Path("_site/lite/index.html")
html = p.read_text()
old = '<link rel="stylesheet" href="app.css">'
new = old + '\n  <link rel="stylesheet" href="../custom.css">'
assert old in html, "app.css link not found in datasette-lite index.html"
p.write_text(html.replace(old, new))
EOF
