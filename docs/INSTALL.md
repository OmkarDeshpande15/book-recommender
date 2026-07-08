# Installation Guide

## Prerequisites

- **Docker** (20.10+) and **Docker Compose** (v2 `docker compose` or v1 `docker-compose`).
- ~1 GB free disk for images.
- Ports **3000** free on your host (8000 and 5432 are internal only, not
  published by default).

Verify Docker:

```bash
docker --version
docker compose version
```

## 1. Get the code

```bash
git clone <your-public-repo-url> book-recommender
cd book-recommender
```

## 2. Build and run

```bash
docker compose up --build
```

What happens on first boot:

1. **db** builds and starts, seeds itself from `db/books_clean.csv` and
   `db/book_genres.csv` (only happens once, on an empty data volume).
2. Docker waits for **db**'s healthcheck to pass.
3. **backend** builds — this step also trains the recommendation model from
   the raw CSVs in `backend/data/` (~6M ratings), which is why the first
   build takes a few minutes. It then connects to Postgres and starts serving.
4. **frontend** builds (Vite) and starts serving via nginx.

When you see `Uvicorn running on http://0.0.0.0:8000` in the backend logs and
the frontend container is up, open:

**http://localhost:3000**

## 3. Stop / reset

```bash
# stop (Ctrl-C if running in the foreground), then:
docker compose down

# to also wipe the seeded database (forces a fresh reseed next time):
docker compose down -v
```

## 4. Optional: hit the backend/db directly

Both are internal-only by default. To expose them for debugging, uncomment
the `ports:` lines under `backend` and `db` in `docker-compose.yml`, then:

- API: http://localhost:8000
- Swagger docs: http://localhost:8000/api/docs
- Postgres: `psql -h localhost -U shelfmate -d shelfmate` (password `shelfmate`)

## Regenerating the data (optional)

Only needed if you change the preprocessing logic or the genre mapping —
the committed CSVs already work out of the box.

```bash
cd backend
pip install -r requirements-build.txt
python app/preprocess.py        # rebuilds the recommender's vectors
python app/build_genres.py      # rebuilds db/book_genres.csv
```

If you change `db/books_clean.csv` or `db/book_genres.csv`, force a reseed:
```bash
docker compose down -v
docker compose up --build
```

## Troubleshooting

- **Port already in use** — change `"3000:80"` in `docker-compose.yml` to
  something free, e.g. `"3001:80"`.
- **Backend can't reach the db** — it retries on startup; if it still fails
  after ~20s, check `docker compose logs db` to confirm it's healthy.
- **Stale data after editing a seed CSV** — the tables only seed once, on an
  empty volume, so run `docker compose down -v` to force a reseed.
