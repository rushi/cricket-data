# cricket-data

Cricket data published as a SQLite database on GitHub Pages, explorable in
the browser with a self-hosted, custom-themed copy of
[Datasette Lite](https://github.com/simonw/datasette-lite). It is a tool for exploring and publishing data. It helps people take data of any shape, analyze and explore it,

## Data

Source CSVs live in `data/`. The men's and women's CSVs share a schema and
are merged at build time (gender is a column). `cricket.db` contains:

| Table / view    | Source                                                 | Notes                                                    |
| --------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| `countries`     | `data/countries.csv`                                   |                                                          |
| `players`       | `data/players-men-international.csv` + `...-women-...` | full-text search on names; bowling styles as JSON arrays |
| `teams`         | `data/teams.csv`                                       | full-text search on names                                |
| `stats`         | `data/stats-men-international.csv` + `...-women-...`   | facets on format and gender                              |
| `formats`       | derived from `stats`                                   | maps `classId` to format name + gender                   |
| `styles`        | `STYLES` in `build.mjs`                                | batting/bowling style code to label                      |
| `player_stats`  | view: `stats` + `players` + `countries`                | adds country, styles and role; searchable by name        |
| `career_totals` | view over `player_stats`                               | one row per player, summed across formats                |

The build also cleans the data:

- `-` placeholders and blank strings become NULL.
- `bat_highScore` (`'400*'`) gets sortable `bat_highScoreRuns` and
  `bat_highScoreNotOut` columns. `bowl_bestInnings` and `bowl_bestMatch`
  (`'10/53'`) get `...Wickets` and `...Runs` columns.
- Style codes (`rfm`, `sla`) become labels. Multi-valued bowling styles
  (`rfm|lb`) become JSON arrays so Datasette facets each style.
- `players.hasStats` flags the players with a `stats` row.
- `isCountry` becomes a real boolean, format names are normalized, and
  team/country image paths become absolute ESPNcricinfo CDN URLs.

`metadata.json` defines facets, column labels, label columns, default
sorts and canned queries. The canned queries take `format`, `gender` and
`country` parameters (blank means all), so one query covers every
leaderboard. `verify.mjs` checks foreign keys, parsed columns and blank
values. The site build fails if any check fails.

## Building locally

Requires Node 24, Python 3, and [sqlite-utils](https://sqlite-utils.datasette.io/):

```sh
pip install sqlite-utils==4.2.1   # or: brew install sqlite-utils
npm install
npm run build                     # builds cricket.db
npm run verify                    # checks it
```

Browse locally with [Datasette](https://datasette.io/):

```sh
datasette cricket.db -m metadata.json
```

## Previewing the full site

```sh
npm run serve   # builds _site/ and serves it at http://localhost:8000
```

`site.mjs` assembles `_site/`: the db, the landing page, `custom.css` (the
theme), and a pinned copy of Datasette Lite (commit is pinned at the top
of the script) with the theme stylesheet injected. Landing page links
install the `datasette-pretty-json` plugin through Datasette Lite's
`?install=` parameter.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which runs
`npm run site` and publishes `_site/` to GitHub Pages.

One-time setup: in the repo's **Settings → Pages**, set **Source** to
**GitHub Actions**.

## Adding more CSVs

Add an `insertCsv` call to `load()` in `build.mjs`, add the table's entry
to `metadata.json` and a card in `index.html`, and push. Row counts and
the db size on the landing page are generated from the db by `site.mjs`
(via `{{tokens}}` in `index.html`); add new tables to `COUNTED_TABLES`.
