#!/usr/bin/env bash
set -euo pipefail

rm -f cricket.db

# Reference tables first — others have foreign keys into them
sqlite-utils insert cricket.db countries data/countries.csv --csv --pk=id
sqlite-utils insert cricket.db players_men data/players-men-international.csv --csv --pk=id
sqlite-utils insert cricket.db players_women data/players-women-international.csv --csv --pk=id
sqlite-utils insert cricket.db teams data/teams.csv --csv --pk=id
sqlite-utils insert cricket.db stats_men data/stats-men-international.csv --csv --pk=playerId --pk=classId
sqlite-utils insert cricket.db stats_women data/stats-women-international.csv --csv --pk=playerId --pk=classId

sqlite-utils add-foreign-key cricket.db players_men countryId countries id
sqlite-utils add-foreign-key cricket.db players_women countryId countries id
sqlite-utils add-foreign-key cricket.db teams countryId countries id
sqlite-utils add-foreign-key cricket.db stats_men playerId players_men id
sqlite-utils add-foreign-key cricket.db stats_women playerId players_women id
