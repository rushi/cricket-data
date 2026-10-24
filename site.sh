#!/usr/bin/env bash
# Assemble the static site into _site/: the SQLite db, landing page,
# custom theme, and a pinned copy of Datasette Lite.
set -euo pipefail

LITE_COMMIT=779b2d4da76a5dc2f1d9aea0d7c8d854f6e1497b

rm -rf _site
mkdir -p _site/lite

./build.sh
cp cricket.db index.html custom.css metadata.json _site/

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
