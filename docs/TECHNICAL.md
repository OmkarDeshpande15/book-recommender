# Technical Documentation

## Overview

BookRec is a hybrid recommender combining **content-based filtering**
(tags/author/title) with **collaborative filtering** (reader ratings). Both
models are precomputed once, at backend image build time, into small NumPy
arrays that get loaded into memory when the API starts — there's no ML
library running at request time, just matrix arithmetic.

## Data model

Two tables in Postgres, seeded once on first container startup from
`db/books_clean.csv` and `db/book_genres.csv`:

**`books`**

| Column                     | Type    | Notes                        |
|----------------------------|---------|-------------------------------|
| book_id                    | INTEGER PK |                            |
| title                      | TEXT    |                                |
| authors                    | TEXT    |                                |
| original_publication_year  | INTEGER |                                |
| average_rating             | REAL    |                                |
| ratings_count               | INTEGER |                                |
| image_url                  | TEXT    | cover art, from the dataset  |
| small_image_url            | TEXT    | thumbnail                     |

**`book_genres`** (many-to-many, up to 3 genres per book)

| Column   | Type    |
|----------|---------|
| book_id  | INTEGER (FK -> books) |
| genre    | TEXT    |

The recommendation *model* is separate from this — see below.

## Feature representation

Each of the 10,000 books gets two vectors, both computed once by
`backend/app/preprocess.py` and saved as `.npy` files baked into the
backend image:

**Content vector (100 dims).** Built from a per-book "soup" of its top 12
Goodreads tags (by vote count, filtered to tags longer than 2 characters to
drop noise like punctuation-only tags) plus its author and title, TF-IDF
vectorized (`max_features=5000`, English stop words removed), then reduced
to 100 dimensions with `TruncatedSVD`.

**Collaborative vector (50 dims).** Built from the raw ratings matrix
(5.9M ratings after de-duplicating on user+book, ~53k users x 10k books),
represented as a `scipy.sparse` matrix, factorized with `TruncatedSVD` to
50 dimensions per book.

Both vectors are L2-normalized (`sklearn.preprocessing.normalize`), so a
dot product between two books' vectors *is* their cosine similarity.

```
content_factors  : (10000, 100)  -- from tags/author/title
collab_factors    : (10000, 50)   -- from the ratings matrix
```

## Recommendation strategies

### 1. Taste-profile matching (`POST /api/recommend`)

```python
liked_idx        = [index of each book_id in shelfBooks]
content_profile  = mean(content_factors[liked_idx])
collab_profile   = mean(collab_factors[liked_idx])

content_scores   = content_factors @ content_profile
collab_scores    = collab_factors @ collab_profile

scores = alpha * content_scores + (1 - alpha) * collab_scores
```
`alpha` (0-1, default 0.5, adjustable in the UI via the match-style slider)
controls the blend: 1.0 is pure content similarity, 0.0 is pure
collaborative filtering. Scores are rescaled from their native `[-1, 1]`
cosine range to `[0, 1]` for display as a percentage. The books already on
the shelf are excluded from results.

### 2. Similar-to-one-book (`GET /api/books/{id}/similar`)

Same code path as above, just called with a single `book_id` instead of a
list — the "taste profile" degenerates to that one book's own vector, so
this is standard item-item similarity.

### 3. Genre browsing (`GET /api/books/by-genre`)

Not similarity-based — a plain SQL join + `ORDER BY ratings_count DESC`.
Genres come from `backend/app/build_genres.py`, which maps ~40 raw Goodreads
shelf tags (`sci-fi`, `ya`, `non-fiction`, `historical`, ...) onto ~20 clean
canonical genre labels and keeps each book's top 3 by vote count. Most tags
in the raw data are noise (`to-read`, `owned`, `kindle`, `2015`...) so this
mapping is curated by hand, not automatic.

### Search (`GET /api/books/search`)

Plain `ILIKE '%query%'` substring match on title/author, ordered by
`ratings_count`. At 10,000 rows this is a fast sequential scan — no
full-text index or search engine needed at this scale.

## Backend structure

- `app/recommender.py` — the `Recommender` class: loads the vectors at
  startup, exposes `.recommend()` and `.known_ids()`. Pure NumPy, no web
  or DB dependencies.
- `app/database.py` — Postgres access via `psycopg2` + a small connection
  pool, with retry-on-connect since the db container may still be starting.
- `app/preprocess.py` — builds the two factor matrices from the raw CSVs.
  Runs once, at backend image build time.
- `app/build_genres.py` — builds `db/book_genres.csv` from the raw tag
  data. Run manually if the source data changes; not part of the Docker
  build (its output is a static, committed file the db image copies in).
- `app/schemas.py` — Pydantic request/response models.
- `app/main.py` — FastAPI routes + a `lifespan` handler that opens the DB
  connection pool before the app serves traffic.

## Frontend structure

- `src/api.ts` — typed `fetch` client; every request goes through here,
  nothing calls `fetch` directly from a component.
- `src/App.tsx` — top-level state (shelf, mode, alpha, similar-book view)
  and the two-tab layout.
- `src/components/CatalogSearch.tsx` — debounced search + autocomplete
  dropdown.
- `src/components/Shelf.tsx` — the selected-books list and the
  content/collaborative blend slider.
- `src/components/GenreBrowse.tsx` — genre chip list + results grid.
- `src/components/BookCard.tsx` — shared result card, used everywhere
  (recommendations, popular list, genre browse, similar-books panel).
- nginx (`frontend/nginx.conf`) serves the built SPA and reverse-proxies
  `/api/*` to the backend container, so the browser only ever talks to one
  origin.

## Container topology

Defined in `docker-compose.yml`:

- **db** — `postgres:16-alpine` extended with a small `Dockerfile` that
  copies in the seed CSVs and `init.sql`. Named volume `bookrec-db-data`
  for persistence. Healthcheck via `pg_isready`.
- **backend** — multi-stage build: a `build` stage installs
  pandas/scipy/scikit-learn and runs `preprocess.py` to produce the
  `.npy` artifacts, then a slim `runtime` stage ships only
  fastapi/numpy/psycopg2 plus those artifacts. `depends_on: db` with
  `condition: service_healthy`.
- **frontend** — multi-stage build: `node:20-alpine` runs the Vite build,
  then `nginx:1.27-alpine` serves the static output and proxies `/api`.

All three join the custom bridge network `bookrec-net`, addressing each
other by Compose service name (`db`, `backend`) via Docker's internal DNS.

## Extending

- **More genres / better mapping**: extend `GENRE_MAP` in
  `build_genres.py`.
- **Bigger dataset**: the current approach precomputes a full
  book x book similarity via matrix multiply at request time, which is fine
  at 10k books but would need an approximate-nearest-neighbour index
  (FAISS, Annoy) at a much larger scale.
- **Personalization beyond one session**: nothing here persists a user's
  shelf between visits — adding accounts + a `user_shelves` table would be
  a natural next step.
