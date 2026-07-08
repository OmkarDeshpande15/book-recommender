# Setup Guide

Supplementary detail to the "Prerequisites" and "Installation and setup"
sections of the main README. Read those first; this document covers
additional configuration, debugging, and troubleshooting steps not
required for a standard first run.

## Verifying prerequisites

```bash
docker --version
docker compose version
```

Both must return a version number. Docker Desktop (or the Docker Engine
on Linux) must be running before `docker compose up` is executed.

## Standard startup

```bash
git clone https://github.com/OmkarDeshpande15/book-recommender.git
cd book-recommender
docker compose up --build
```

Startup order, as defined in `docker-compose.yml`:

1. The `db` container builds and starts, then seeds itself from
   `db/books_clean.csv` and `db/book_genres.csv`. This seeding step runs
   only once, the first time the container starts with an empty data
   volume.
2. Docker Compose waits for the `db` container's healthcheck
   (`pg_isready`) to report healthy before starting the backend.
3. The `backend` container builds. The build step trains the
   recommendation model from the raw dataset CSVs, which is the slowest
   part of the first build (several minutes, depending on hardware).
   Once built, the backend connects to PostgreSQL and begins serving
   requests.
4. The `frontend` container builds (a Vite production build) and starts
   nginx, which serves the built application and proxies API requests to
   the backend.

The application is ready once `http://localhost:3000` loads successfully
and the backend log shows `Uvicorn running on http://0.0.0.0:8000`.

## Stopping and resetting

Stop the application:
```bash
docker compose down
```

Stop the application and remove the database's persisted volume, forcing
a full reseed on the next startup:
```bash
docker compose down -v
docker compose up --build
```

This step is required whenever the contents of `db/books_clean.csv` or
`db/book_genres.csv` change, since the database only runs its seed
script once, against an empty data volume. Running `docker compose up
--build` without `down -v` first will not pick up schema or seed-data
changes.

## Exposing ports for debugging

By default, only the frontend's port (3000) is published to the host.
The backend and database ports are internal to the Docker network and
are not reachable from outside the container network unless explicitly
exposed.

To expose them, uncomment the corresponding `ports:` entries under the
`backend` and `db` services in `docker-compose.yml`, then restart the
containers. Once exposed:

- Backend API: `http://localhost:8000`
- Interactive API documentation (Swagger UI): `http://localhost:8000/api/docs`
- PostgreSQL: connect with `psql -h localhost -U nextread -d nextread`
  (password: `nextread`)

The database credentials are defined directly in `docker-compose.yml`
rather than in a separate secrets file. This is appropriate for this
submission because the database contains only public dataset content
with no sensitive information; in a production deployment, credentials
of this kind would instead be supplied through environment variables or
a secrets manager.

## API endpoint summary

```
GET  /api/health
GET  /api/books/search?q=&limit=
GET  /api/books/popular?limit=
GET  /api/books/{id}/similar?limit=
GET  /api/genres
GET  /api/books/by-genre?genre=&limit=
POST /api/recommend        body: { book_ids, top_n?, alpha? }
```

## Regenerating the recommendation model or genre data

Required only if the preprocessing logic itself is modified; the CSVs
already committed to the repository are sufficient for a standard run.

```bash
cd backend
pip install -r requirements-build.txt
python app/preprocess.py       # rebuilds content_factors.npy and collab_factors.npy
python app/build_genres.py     # rebuilds db/book_genres.csv
```

After regenerating, apply the changes with:
```bash
docker compose down -v
docker compose up --build
```

## Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| Port 3000 already in use | Another process is bound to port 3000 | Change `"3000:80"` under the `frontend` service in `docker-compose.yml` to an available port |
| Backend fails to connect to the database at startup | The `db` container has not yet finished starting | The backend retries automatically for a short period; if it continues to fail after approximately 20 seconds, check `docker compose logs db` to confirm the container is healthy |
| Genre or book data appears empty or outdated after a data change | The database volume still holds the previous seed data | Run `docker compose down -v` before rebuilding, since the seed script only executes on an empty volume |
