# Setup

## what you need

Docker + Docker Compose. Nothing else — everything else runs inside
containers.

```
docker --version
docker compose version
```

## running it

```
git clone https://github.com/OmkarDeshpande15/book-recommender.git
cd book-recommender
docker compose up --build
```

First run takes a few minutes — the backend build step also trains the
recommendation model from the raw CSVs (about 6 million rows), so that's
where most of the time goes. Everything after that is fast since the
model gets baked into the image.

Once you see the backend log `Uvicorn running on http://0.0.0.0:8000` and
the frontend container is up, go to:

http://localhost:3000

## stopping / resetting

Ctrl+C, then:
```
docker compose down
```

If you want to wipe the database too (e.g. you edited something under
`db/` and want it to reseed):
```
docker compose down -v
docker compose up --build
```
Postgres only runs its seed script the first time it starts on an empty
volume, so `down -v` is the way to force a redo.

## poking at things directly

By default only the frontend port is exposed (3000). If you want to hit
the backend or the database directly for debugging, uncomment the `ports:`
lines under `backend` and `db` in `docker-compose.yml`, then:

- API: http://localhost:8000, swagger docs at http://localhost:8000/api/docs
- Postgres: `psql -h localhost -U shelfmate -d shelfmate` (password is
  also `shelfmate` — it's hardcoded in the compose file since this is a
  demo project seeded entirely from public data, nothing sensitive)

## endpoints

```
GET  /api/health
GET  /api/books/search?q=&limit=
GET  /api/books/popular?limit=
GET  /api/books/{id}/similar?limit=
GET  /api/genres
GET  /api/books/by-genre?genre=&limit=
POST /api/recommend       body: { book_ids, top_n?, alpha? }
```

## regenerating the data

Only needed if you're changing the preprocessing logic — the committed
CSVs already work as-is.

```
cd backend
pip install -r requirements-build.txt
python app/preprocess.py       # rebuilds the recommendation vectors
python app/build_genres.py     # rebuilds the genre labels
```

then `docker compose down -v && docker compose up --build` to pick up the
changes.

## if something's not working

- port 3000 taken → change `"3000:80"` in docker-compose.yml to something
  free
- backend can't reach postgres on startup → it retries for a bit on its
  own; if it's still failing after ~20s check `docker compose logs db`
- old/wrong data showing up after you changed a seed file → you need
  `docker compose down -v`, the tables only seed once
