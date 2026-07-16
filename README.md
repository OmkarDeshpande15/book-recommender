# NextRead

**At a glance**

| | |
|---|---|
| Type | Recommendation service (see Section 1) |
| Stack | React + TypeScript (frontend) · Python/FastAPI (backend) · PostgreSQL (database) |
| Data | goodbooks-10k — 10,000 books, ~6,000,000 ratings |
| Run it | `docker compose up --build`, then open `http://localhost:3000` (see Section 5–6) |

**Contents**

- [1. Project classification](#1-project-classification)
- [2. Why this project, and what is special about it](#2-why-this-project-and-what-is-special-about-it)
- [3. Features](#3-features)
- [4. Architecture](#4-architecture)
- [5. Prerequisites](#5-prerequisites)
- [6. Installation and setup](#6-installation-and-setup)
- [7. How to use the application](#7-how-to-use-the-application)
- [8. API reference](#8-api-reference)
- [9. Data source and preparation](#9-data-source-and-preparation)
- [10. Technical explanation of the recommendation logic](#10-technical-explanation-of-the-recommendation-logic)
- [11. Project structure](#11-project-structure)
- [12. Technology stack](#12-technology-stack)
- [13. Declarations](#13-Declarations)

## 1. Project classification

The project brief defines three acceptable application types: Matching,
Recommendation, and Image Recognition. This project is a **Recommendation
service**: a user provides input (books they already like, or a genre
preference), and the system returns multiple ranked results based on that
input — the same category as the brief's own example of movie suggestions
on a streaming platform. It is not a Matching-type application (which
would pair two entities against each other, such as a dating-website
match), since there is only one side making a request and receiving
suggestions.

## 2. Why this project, and what is special about it

Most consumer "recommended for you" features are driven primarily by
popularity — what is trending, what has the most reviews — rather than by
the actual content of the item being recommended. I wanted to build a
system where the recommendation logic is based on measurable properties
of the books themselves (their tags and genre signals) combined with
actual reader behavior (rating patterns), and where every recommendation
can be explained in terms of those two signals rather than being a
black-box output.

What distinguishes this submission from a minimal implementation:

- **Two independent recommendation models, blended.** A content-based
  model (built from each book's tags, author, and title) and a
  collaborative-filtering model (built from approximately six million
  reader ratings) are computed separately and combined with an adjustable
  weight, exposed to the user as a slider in the interface. This avoids
  the two most common failure modes of single-signal recommenders:
  content-only systems tend to over-recommend the same author, and
  ratings-only systems cannot explain why a result was chosen.
- **A genre-browsing mode independent of the recommendation models.**
  Users who do not wish to select books first can browse by one of
  twenty curated genre categories, extracted from approximately 22,800
  raw tag records that were otherwise mostly non-genre noise (see Section
  9, "Data source and preparation").
- **Single-item recommendations ("more like this").** In addition to
  recommending from a multi-book profile, any individual book can be used
  as the sole basis for a recommendation request, which is useful when a
  user wants to explore variations on one specific title rather than
  build a broader taste profile.
- **No external API dependency at runtime.** Cover images are served
  directly from URLs already present in the source dataset, so the
  system has no third-party API calls, no API keys, and no external
  runtime dependency beyond the three containers themselves.

## 3. Features

| Feature | Description |
|---|---|
| Taste-based recommendation | User selects up to 10 books; system returns ranked recommendations based on a blended content + collaborative-filtering model |
| Match-weight control | User-adjustable slider controlling the blend between content similarity and collaborative-filtering similarity |
| Single-book recommendation | "More like this" — recommendations generated from one specific book |
| Genre browsing | Browse the highest-rated books within any of 20 curated genre categories, without requiring prior book selection |
| Search | Debounced, case-insensitive search by title or author |

A full usage walkthrough with screenshots for every control is in
[docs/User Manual.md](docs/User_Manual.md), including a supplementary
visual PDF: [docs/NextRead_Screenshot_Walkthrough.pdf](docs/NextRead_Screenshot_Walkthrough.pdf).

## 4. Architecture

```
                        ┌──────────────────────────────────┐
  Browser  ── HTTP ──▶  │ frontend (nginx + React/TS SPA)   │
                        │  serves the built application;    │
                        │  reverse-proxies /api to backend  │
                        └────────────────┬───────────────────┘
                                         │  HTTP, over the internal
                                         │  Docker network
                        ┌────────────────▼───────────────────┐
                        │ backend (FastAPI + Uvicorn)         │
                        │  REST API; recommendation logic     │
                        │  runs in-memory (precomputed model) │
                        └────────────────┬───────────────────┘
                                         │  SQL, via psycopg2
                        ┌────────────────▼───────────────────┐
                        │ db (PostgreSQL 16)                   │
                        │  book metadata + genre mapping,      │
                        │  seeded automatically on first boot  │
                        └──────────────────────────────────────┘

     All three containers share the custom bridge network
                      "nextread-net".
```

The frontend and backend are separated into independent containers and
communicate exclusively through the REST API described in Section 8. The
database is likewise its own container, connected to the backend over the
same custom Docker network, satisfying the brief's requirement that the
web application and the database each be containerized and connected
through a custom Docker network.

## 5. Prerequisites

The following must be installed on the machine running this project:

1. **Docker**, version 20.10 or later.
2. **Docker Compose**, either the current `docker compose` (v2, bundled
   with Docker Desktop) or the standalone `docker-compose` (v1).
3. Approximately 1 GB of free disk space for container images.
4. Port **3000** available on the host machine (ports 8000 and 5432, used
   internally by the backend and database, are not published to the host
   by default and do not need to be free).

To verify the prerequisites are met:

```bash
docker --version
docker compose version
```

Both commands should return a version number without error.

**Platform testing:** this project has been verified to build and run
successfully via `docker compose up --build` on both Windows (primary
development machine) and macOS (tested on a separate machine via a clean
`git clone` of this repository). No platform-specific issues were
encountered on either system.

## 6. Installation and setup

1. Clone the repository:
   ```bash
   git clone https://github.com/OmkarDeshpande15/book-recommender.git
   cd book-recommender
   ```
2. Build and start all three containers:
   ```bash
   docker compose up --build
   ```
3. Wait for the build to complete. On first run, the backend build step
   also trains the recommendation model from the raw dataset (~6 million
   rating records), which takes several minutes; this happens only once,
   as the resulting model is stored inside the built image. Subsequent
   builds are faster.
4. Once the backend log shows `Uvicorn running on http://0.0.0.0:8000`
   and the frontend container has started, open a browser and navigate
   to:
   ```
   http://localhost:3000
   ```

To stop the application:
```bash
docker compose down
```

To stop the application and remove the persisted database volume (this
forces the database to be reseeded from scratch on next startup — needed
if the seed data or schema is modified):
```bash
docker compose down -v
```

Further setup detail, including how to expose the backend/database ports
directly for debugging and how to regenerate the model artifacts, is in
[docs/Installation_Guide.md](docs/Installation_Guide.md).

## 7. How to use the application

Once the application is open at `http://localhost:3000`, two modes are
available, selected via the tabs beneath the search bar.

**Taste-match mode (default):**
1. Use the search field to look up a book by title or author.
2. Select a result to add it to "Your shelf" (up to 10 books).
3. Optionally, adjust the match-weight slider to bias results toward
   genre/tag similarity or toward reader-behavior similarity. The default
   position weights both signals equally.
4. Select "Get recommendations." The system returns a ranked list of
   books, each annotated with a match percentage.

**Genre-browse mode:**
1. Select the "Browse by genre" tab.
2. Select any genre chip (each is labeled with the number of books
   carrying that genre). The highest-rated books in that genre are
   displayed.

**Single-book recommendations, available from either mode:**
- Select "more like this" on any result card to view recommendations
  generated from that one book specifically. Select "back" to return to
  the previous view.

A full usage walkthrough, including a screenshot-referenced step-by-step
guide for every control in the interface, is in
[docs/User Manual.md](docs/User_Manual.md).

## 8. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Liveness and database-connectivity check |
| GET | `/api/books/search?q=&limit=` | Search books by title or author |
| GET | `/api/books/popular?limit=` | Highest rated-count books, used for the default landing state |
| GET | `/api/books/{id}/similar?limit=` | Recommendations generated from a single book |
| GET | `/api/genres` | List of available genres with book counts |
| GET | `/api/books/by-genre?genre=&limit=` | Books tagged with a given genre |
| POST | `/api/recommend` | Taste-based recommendations; body: `{ book_ids: number[], top_n?: number, alpha?: number }` |

Interactive API documentation (Swagger UI) is available at
`/api/docs` on the backend once the backend port has been exposed (see
"exposing ports for debugging" in [docs/Installation_Guide.md](docs/Installation_Guide.md)).

## 9. Data source and preparation

**Source:** [goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k),
a publicly available dataset consisting of 10,000 books and approximately
6,000,000 user ratings, originally collected from Goodreads. The same
dataset is also published on Kaggle under the same author; the GitHub
release was used here because it is the more recent version, with
duplicate ratings removed and a larger number of ratings than the Kaggle
copy, per the dataset author's own documentation. The raw CSV files are
committed to this repository (`backend/data/`) so that the project builds
without requiring an internet download at container build time.

**Preparation steps performed** (implemented in
`backend/app/preprocess.py` and `backend/app/build_genres.py`):

1. Missing values in publication year, average rating, and author fields
   were filled with defined defaults during loading.
2. For each book, the top 12 highest-voted tags (from `book_tags.csv` /
   `tags.csv`) were combined with the book's author and title into a
   single text string.
3. That text was vectorized using term frequency–inverse document
   frequency (TF-IDF, `scikit-learn`'s `TfidfVectorizer`, 5,000 maximum
   features, English stop words removed).
4. The resulting TF-IDF matrix was reduced to 100 dimensions per book
   using truncated singular value decomposition (SVD).
5. Separately, the ratings data (`ratings.csv`, deduplicated on user and
   book, approximately 5.9 million rows remaining) was represented as a
   sparse user-by-book matrix and reduced to 50 dimensions per book,
   again using truncated SVD.
6. Both resulting vectors were L2-normalized, so that a dot product
   between any two book vectors is equivalent to their cosine similarity.
7. For genre browsing, raw Goodreads tags were mapped by hand from
   approximately 40 recognizable variants (e.g., `sci-fi`, `ya`,
   `non-fiction`, `historical`) onto 20 clean, human-readable genre
   labels; each book's top 3 genres by tag-vote count were retained. The
   remaining tags (logistical/status tags such as `to-read`, `owned`,
   `kindle`, or year-based tags) were discarded as non-genre noise.
8. Cleaned book metadata and the genre mapping were exported to CSV files
   (`db/books_clean.csv`, `db/book_genres.csv`) and are loaded into
   PostgreSQL automatically when the database container starts for the
   first time.

**Tools used:** Python, pandas, NumPy, scikit-learn (`TfidfVectorizer`,
`TruncatedSVD`, `normalize`), SciPy (sparse matrix construction).

## 10. Technical explanation of the recommendation logic

Both precomputed vectors (content, 100 dimensions; collaborative
filtering, 50 dimensions) are loaded into memory once, at backend
startup, from small NumPy files baked into the backend Docker image.
Because both are L2-normalized, comparing any two books is a single dot
product.

For a taste-based recommendation request, the vectors of the user's
selected books are averaged to form a "taste profile" — one profile for
the content vectors, one for the collaborative-filtering vectors. Every
book in the catalogue is then scored against both profiles, and the two
scores are combined using a weighted sum:

```
score = alpha × content_similarity + (1 − alpha) × collaborative_similarity
```

`alpha` corresponds to the match-weight slider in the interface (default
0.5). Scores are re-scaled from cosine similarity's native range of
[−1, 1] to [0, 1] for display as a percentage. Books already present on
the user's shelf are excluded from the results.

The single-book "more like this" endpoint uses the identical scoring
function, called with a list containing one book, so the "profile"
reduces to that book's own vector — standard item-to-item similarity.

Genre browsing does not use either vector; it is a direct SQL query
against the `book_genres` table, ordered by rating count, since genre
membership is categorical rather than similarity-based.

A complete line-by-line explanation is in
[docs/HOW_IT_WORKS.md](docs/How_It_Works.md).

## 11. Project structure

```
book-recommender/
├── docker-compose.yml
├── README.md
├── docs/
│   ├── Installation_Guide.md
│   ├── User_Manual.md
│   ├── How_It_Works.md
│   └── NextRead_Screenshot_Walkthrough.pdf
├── db/
│   ├── Dockerfile
│   ├── init.sql
│   ├── books_clean.csv
│   └── book_genres.csv
├── backend/
│   ├── Dockerfile
│   ├── requirements-build.txt
│   ├── requirements-runtime.txt
│   ├── data/
│   │   ├── books.csv
│   │   ├── ratings.csv
│   │   ├── tags.csv
│   │   └── book_tags.csv
│   └── app/
│       ├── main.py
│       ├── recommender.py
│       ├── database.py
│       ├── schemas.py
│       ├── preprocess.py
│       └── build_genres.py
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

## 12. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, nginx (static serving + reverse proxy) |
| Backend | Python, FastAPI, Uvicorn, Pydantic, NumPy, psycopg2 |
| Recommendation model (build-time only) | pandas, SciPy, scikit-learn |
| Database | PostgreSQL 16 |
| Infrastructure | Docker, Docker Compose, custom bridge network |

No JavaScript UI framework beyond React was used, and jQuery was not
used, in accordance with the project brief.

## 13. Declarations

1.This project was built with the help of an AI coding assistant (Claude),
used to move faster on implementation while the architecture, technology
choices, and their tradeoffs stayed with me.

Approximate share of AI assistance by area:

| Area | Used for | AI assistance |
|---|---|---|
| Frontend | Component implementation, styling, layout | ~70% |
| Backend | API routes, recommendation logic, database layer | ~40% |
| Docker / infrastructure | Dockerfiles, compose configuration, nginx | ~10% |

2.This project has also been verified to run successfully on macOS (see
Section 5, "Prerequisites"), in addition to Windows.
