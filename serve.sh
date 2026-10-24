#!/usr/bin/env bash
# Build the site and preview it at http://localhost:8000
set -euo pipefail

./site.sh
cd _site
echo "Serving at http://localhost:8000"
python3 -m http.server 8000
