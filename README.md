# Shelfmate — book recommendation service

A matching/recommendation web app for the recruitment project round. You add
a few books you like to a shelf, and it recommends what to read next.

## Why I picked this

I wanted something where the matching logic is actually explainable instead
of a black box, and where the results are satisfying to show live (book
covers instead of a table of numbers). Book recommendation fit that well,
and goodbooks-10k is a solid dataset to build on — 10k books and 6M ratings
is enough to get results that feel real, not random.

The recommender blends two models instead of just one:
- a content-based one, from each book's tags/author/title (TF-IDF + SVD)
- a collaborative-filtering one, learned from the ratings matrix (SVD)

Content-only recommenders tend to just recommend the same author over and
over. Ratings-only ones can't explain themselves. Blending both gives
better and more explainable results — see `recommender.py`.

## How it works

1. Every book gets two vectors, computed once (see `preprocess.py`):
   - content vector: top tags + author + title → TF-IDF → reduced to 100
     dims with SVD
   - collaborative vector: the user×book ratings matrix (5.9M ratings,
     ~53k users) → reduced to 50 dims with SVD
   Both are normalized, so a dot product between two books is their cosine
   similarity.
2. When you pick books, the API averages their vectors into a "taste
   profile" (one for content, one for collaborative).
3. It scores every book in the catalogue against that profile with a
   weighted blend (`alpha`, 0.5 by default) and returns the top matches.

Every recommendation can be traced back to specific tags/ratings — nothing
here is a black box.

## Architecture

```
frontend (nginx, :3000) --/api--> backend (FastAPI, :8000) --SQL--> db (Postgres, :5432)
```

All three on a custom Docker bridge network (`shelfmate-net`), each with its
own Dockerfile:

- **frontend** — React + TypeScript built with Vite, served by nginx. Nginx
  also proxies `/api/*` to the backend container.
- **backend** — FastAPI. Runs the matching logic, queries Postgres for book
  metadata.
- **db** — Postgres, seeded automatically on first boot from
  `db/books_clean.csv` via `db/init.sql`. Data persists in a named volume.

The recommendation model (the two vectors above) is separate from the
metadata database — it's built once at backend image build time from the
raw CSVs and baked into the image as small numpy files, so the backend
never needs pandas/scikit-learn at runtime, just the small vectors.

`backend` waits for `db`'s healthcheck before starting, and also retries
the connection itself as a fallback.

## Data source

[goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) — 10,000 books
and ~6,000,000 ratings, originally from Goodreads. Raw CSVs are committed
in `backend/data/` so the whole thing builds without needing internet
access at container build time.

## Running it

Needs Docker + Docker Compose.

```bash
git clone <this-repo-url>
cd book-recommender
docker compose up --build
```

Then open http://localhost:3000.

First build takes a few minutes (installing deps + training the model from
~6M ratings). After that it's fast since the artifacts are baked in.

The backend and db ports aren't published to the host by default — the
frontend talks to the backend internally, and the backend talks to the db
internally. Uncomment the `ports` lines in `docker-compose.yml` if you want
to hit either directly while developing.

Postgres credentials are hardcoded in `docker-compose.yml` (`shelfmate` /
`shelfmate`) since this is a demo seeded from public data with nothing
sensitive in it — in a real deployment these would be env vars/secrets.

If you edit `db/init.sql` and want it to reseed, you need to drop the
volume first (Postgres only runs the seed script on an empty data dir):
```bash
docker compose down -v
docker compose up --build
```

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | liveness + DB check |
| GET | `/api/books/search?q=&limit=` | search by title/author |
| GET | `/api/books/popular?limit=` | starter list for the empty state |
| POST | `/api/recommend` | `{ book_ids, top_n?, alpha? }` → recommendations |

Swagger docs at `/api/docs` on the backend once it's running.

## Project layout

```
book-recommender/
├── docker-compose.yml
├── db/
│   ├── Dockerfile
│   ├── init.sql             # creates the books table, loads the CSV
│   └── books_clean.csv
├── backend/
│   ├── Dockerfile
│   ├── requirements-build.txt    # pandas/scipy/sklearn, build stage only
│   ├── requirements-runtime.txt  # what actually ships
│   ├── data/                # raw goodbooks-10k CSVs
│   └── app/
│       ├── preprocess.py    # builds the model vectors
│       ├── recommender.py   # matching/scoring logic
│       ├── database.py      # postgres access
│       ├── schemas.py
│       └── main.py          # FastAPI routes
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api.ts
        ├── types.ts
        ├── App.tsx
        └── components/
            ├── CatalogSearch.tsx
            ├── Shelf.tsx
            └── BookCard.tsx
```

## Stack

Python/FastAPI + numpy + psycopg2 (backend), Postgres (db), React +
TypeScript + Vite (frontend, no UI framework, no jQuery), Docker Compose.

## Originality

The recommender logic, API, DB schema, preprocessing script, and frontend
are all written for this project. The only outside inputs are the declared
dataset (goodbooks-10k) and standard libraries (FastAPI, React, scikit-learn
etc.) used as tools.
