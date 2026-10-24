#!/usr/bin/env bash
set -euo pipefail

rm -f cricket.db

# Reference table first — others have foreign keys into it
sqlite-utils insert cricket.db countries data/countries.csv --csv --pk=id

# Men's and women's CSVs share a schema and player ids never overlap,
# so they load into single players/stats tables (gender is a column).
sqlite-utils insert cricket.db players data/players-men-international.csv --csv --pk=id
sqlite-utils insert cricket.db players data/players-women-international.csv --csv --pk=id

sqlite-utils insert cricket.db teams data/teams.csv --csv --pk=id

sqlite-utils insert cricket.db stats data/stats-men-international.csv --csv --pk=playerId --pk=classId
sqlite-utils insert cricket.db stats data/stats-women-international.csv --csv --pk=playerId --pk=classId

# Denormalize gender onto stats so it can be faceted/filtered directly
sqlite-utils add-column cricket.db stats gender text
sqlite-utils query cricket.db "
  update stats set gender = (select gender from players where players.id = stats.playerId)
"

# Data cleanup -------------------------------------------------------

# '-' placeholders in the CSVs mean "no value" — store them as NULL so
# filtering and sorting behave
sqlite-utils query cricket.db "update stats set bat_highScore = null where bat_highScore = '-'"
sqlite-utils query cricket.db "update stats set bowl_bestInnings = null where bowl_bestInnings = '-'"
sqlite-utils query cricket.db "update stats set bowl_bestMatch = null where bowl_bestMatch = '-'"

# Format names duplicate the gender column ("Women's ODIs"); normalize
# to canonical names now that gender is its own column
sqlite-utils query cricket.db "update stats set format = replace(format, 'Women''s ', '')"

# isCountry arrives as the text 'true'/'false' — store as integer 1/0
sqlite-utils convert cricket.db teams isCountry \
  '1 if value == "true" else 0' --output-type integer
sqlite-utils transform cricket.db teams --type isCountry integer

# Formats reference table (classId -> canonical name + gender)
sqlite-utils query cricket.db "
  select distinct classId as id, format as name, gender from stats order by id
" --csv | sqlite-utils insert cricket.db formats - --csv --pk=id

# Foreign keys ---------------------------------------------------------

sqlite-utils add-foreign-key cricket.db players countryId countries id
sqlite-utils add-foreign-key cricket.db teams countryId countries id
sqlite-utils add-foreign-key cricket.db stats playerId players id
sqlite-utils add-foreign-key cricket.db stats classId formats id

# Full-text search -----------------------------------------------------

sqlite-utils enable-fts cricket.db players name longName fullName
sqlite-utils enable-fts cricket.db teams name longName

sqlite-utils vacuum cricket.db
