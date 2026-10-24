# cricket-data

Cricket data published as a SQLite database on GitHub Pages, explorable in
the browser with a self-hosted, custom-themed copy of
[Datasette Lite](https://github.com/simonw/datasette-lite). It is a tool for exploring and publishing data. It helps people take data of any shape, analyze and explore it,

## Data

Source CSVs live in `data/`. The men's and women's CSVs share a schema and
are merged at build time (gender is a column). Currently loaded into
`cricket.db`:

| Table       | Source                                                              | Notes                                   |
| ----------- | ------------------------------------------------------------------- | --------------------------------------- |
| `countries` | `data/countries.csv`                                                |                                         |
| `players`   | `data/players-men-international.csv` + `...-women-...`              | full-text search on names               |
| `teams`     | `data/teams.csv`                                                    | full-text search on names               |
| `stats`     | `data/stats-men-international.csv` + `...-women-...`                | facets on format and gender             |
| `formats`   | derived from `stats`                                                | maps `classId` to format name + gender  |

The build also cleans the data (`-` placeholders become NULL, `isCountry`
becomes a real boolean, format names are normalized), adds foreign keys,
and vacuums the db. `metadata.json` defines facets, column labels, default
sorts and canned leaderboard queries.

## Building locally

Requires [sqlite-utils](https://sqlite-utils.datasette.io/):

```sh
pip install sqlite-utils   # or: brew install sqlite-utils
./build.sh                 # builds cricket.db
```

Browse locally with [Datasette](https://datasette.io/):

```sh
datasette cricket.db -m metadata.json
```

## Previewing the full site

```sh
./serve.sh   # builds _site/ and serves it at http://localhost:8000
```

`site.sh` assembles `_site/`: the db, the landing page, `custom.css` (the
theme), and a pinned copy of Datasette Lite (commit is pinned at the top
of the script) with the theme stylesheet injected.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which runs
`site.sh` and publishes `_site/` to GitHub Pages.

One-time setup: in the repo's **Settings → Pages**, set **Source** to
**GitHub Actions**.

## Adding more CSVs

Add another `sqlite-utils insert` line to `build.sh`, add the table's
entry to `metadata.json` and a card in `index.html`, and push. Row counts
and the db size on the landing page are generated from the db by
`site.sh` (via `{{tokens}}` in `index.html`), so they stay in sync
automatically.
