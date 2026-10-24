#!/usr/bin/env bash
set -euo pipefail

rm -f cricket.db

sqlite-utils insert cricket.db countries data/countries.csv --csv --pk=id
sqlite-utils insert cricket.db players data/players-women-international.csv --csv --pk=id

sqlite-utils add-foreign-key cricket.db players countryId countries id
