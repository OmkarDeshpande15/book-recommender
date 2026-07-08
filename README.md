# Shelfmate — book recommendation service

A matching/recommendation web app for the recruitment project round. Add a
few books you like, get recommendations based on tags and reader ratings.
Also supports browsing by genre and finding books similar to one specific
title.

```bash
docker compose up --build
```
Then open **http://localhost:3000**.

---

## Table of contents

- [Why this project](#why-this-project)
- [Features](#features)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Data source](#data-source)
- [Running it](#running-it)
- [API](#api)
- [Project layout](#project-layout)
- [Tech stack](#tech-stack)
- [Originality](#originality)

---

## Why this project

I wanted something where the matching logic is actually explainable instead
of a black box, and where results are satisfying to show live (book covers,
not a table of numbers). Book recommendation fit that well, and
goodbooks-10k is a solid dataset to build on — 10k books and 6M ratings is
enough to get results that feel real, not random.

## Features

- **Taste match** — pick a few books, get recommendations blending
  content similarity (tags/author) and collaborative filtering (reader
  ratings), with a slider to control the blend yourself.
- **More like this** — on any book, get item-to-item recommendations for
  that one title specifically.
- **Browse by genre** — ~20 curated genres (Fantasy, Mystery, Romance,
  Nonfiction, ...) extracted from the raw tag data, browsable without
  needing to pick books first.

## How it works

The recommender blends two models instead of just one:
- a content-based one, from each book's tags/author/title (TF-IDF + SVD)
- a collaborative-filtering one, learned from the ratings matrix (SVD)

Content-only recommenders tend to just recommend the same author over and
over. Ratings-only ones can't explain themselves. Blending both gives
better and more explainable results.

1. Every book gets two vectors, computed once (see `backend/app/preprocess.py`):
   - content vector: top tags + author + title → TF-IDF → reduced to 100
     dims with SVD
   - collaborative vector: the user×book ratings matrix (5.9M ratings,
     ~53k users) → reduced to 50 dims with SVD
   Both are normalized, so a dot product between two books is their cosine
   similarity.
2. When you pick books, the API averages their vectors into a "taste
   profile" (one for content, one for collaborative).
3. It scores every book in the catalogue against that profile with a
   weighted blend (`alpha`, adjustable in the UI, 0.5 by default) and
   returns the top matches.

Genres work differently — they're not similarity-based, just a curated
mapping from the messy raw Goodreads tags to ~20 clean labels (see
`backend/app/build_genres.py`), stored in their own Postgres table.

Full technical write-up: **[docs/TECHNICAL.md](docs/TECHNICAL.md)**.

## Architecture

```
frontend (nginx, :3000) --/api--> backend (FastAPI, :8000) --SQL--> db (Postgres, :5432)
```

All three on a custom Docker bridge network (`shelfmate-net`), each with its
own Dockerfile:

- **frontend** — React + TypeScript built with Vite, served by nginx. Nginx
  also proxies `/api/*` to the backend container.
- **backend** — FastAPI. Runs the matching logic, queries Postgres for book
  metadata and genres.
- **db** — Postgres, seeded automatically on first boot from
  `db/books_clean.csv` and `db/book_genres.csv`. Data persists in a named
  volume.

The recommendation model (the two vectors above) is separate from the
metadata database — it's built once at backend image build time from the
raw CSVs and baked into the image as small numpy files, so the backend
never needs pandas/scikit-learn at runtime, just the small vectors.

`backend` waits for `db`'s healthcheck before starting, and also retries
the connection itself as a fallback.

## Data source

[goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) — 10,000 books
and ~6,000,000 ratings, originally from Goodreads. The same dataset is also
mirrored on Kaggle: https://www.kaggle.com/datasets/zygmunt/goodbooks-10k
(the GitHub release is the current one — it has duplicate ratings removed
and more ratings than the Kaggle copy, per the dataset author's own notes).

Raw CSVs are committed in `backend/data/` so the whole thing builds without
needing internet access at container build time. No external API keys are
used anywhere — cover images come directly from URLs already in the
dataset, not fetched from a third party at runtime.

## Running it

Full guide: **[docs/INSTALL.md](docs/INSTALL.md)**. Short version:

```bash
git clone <this-repo-url>
cd book-recommender
docker compose up --build
```

First build takes a few minutes (installing deps + training the model from
~6M ratings). After that it's fast since the artifacts are baked in.

Postgres credentials are hardcoded in `docker-compose.yml` (`shelfmate` /
`shelfmate`) since this is a demo seeded from public data with nothing
sensitive in it — in a real deployment these would be env vars/secrets.

Usage walkthrough: **[docs/USAGE.md](docs/USAGE.md)**.

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | liveness + DB check |
| GET | `/api/books/search?q=&limit=` | search by title/author |
| GET | `/api/books/popular?limit=` | starter list for the empty state |
| GET | `/api/books/{id}/similar?limit=` | books similar to one specific book |
| GET | `/api/genres` | list of genres with book counts |
| GET | `/api/books/by-genre?genre=&limit=` | books tagged with a genre |
| POST | `/api/recommend` | `{ book_ids, top_n?, alpha? }` → taste-match recommendations |

Swagger docs at `/api/docs` on the backend once it's running.

## Project layout

```
book-recommender/
├── docker-compose.yml
├── docs/
│   ├── INSTALL.md
│   ├── USAGE.md
│   └── TECHNICAL.md
├── db/
│   ├── Dockerfile
│   ├── init.sql              # creates tables, loads the CSVs
│   ├── books_clean.csv
│   └── book_genres.csv
├── backend/
│   ├── Dockerfile
│   ├── requirements-build.txt    # pandas/scipy/sklearn, build stage only
│   ├── requirements-runtime.txt  # what actually ships
│   ├── data/                # raw goodbooks-10k CSVs
│   └── app/
│       ├── preprocess.py    # builds the model vectors
│       ├── build_genres.py  # builds the genre mapping
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
            ├── GenreBrowse.tsx
            └── BookCard.tsx
```

## Tech stack

Python/FastAPI + numpy + psycopg2 (backend), Postgres (db), React +
TypeScript + Vite (frontend, no UI framework, no jQuery), Docker Compose.

## Originality

The recommender logic, API, DB schema, preprocessing scripts, and frontend
are all written for this project. The only outside inputs are the declared
dataset (goodbooks-10k) and standard libraries (FastAPI, React, scikit-learn
etc.) used as tools.
