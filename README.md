# cricket-data

Cricket data published as a SQLite database on GitHub Pages, explorable in
the browser with a self-hosted, custom-themed copy of
[Datasette Lite](https://github.com/simonw/datasette-lite). It is a tool for exploring and publishing data. It helps people take data of any shape, analyze and explore it,

## Data

Source CSVs live in `data/`. Currently loaded into `cricket.db`:

| Table           | Source                                 | Rows  |
| --------------- | -------------------------------------- | ----- |
| `countries`     | `data/countries.csv`                   | 116   |
| `players_men`   | `data/players-men-international.csv`   | 4,758 |
| `players_women` | `data/players-women-international.csv` | 1,502 |
| `teams`         | `data/teams.csv`                       | 4,124 |
| `stats_men`     | `data/stats-men-international.csv`     | 6,805 |
| `stats_women`   | `data/stats-women-international.csv`   | 2,608 |

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

Add another `sqlite-utils insert` line to `build.sh`, update the table
above and the cards/stats in `index.html`, and push.
