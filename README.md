# Shelfmate

Book recommendations based on tags and reader ratings, not popularity.
Built for the recruitment project round (matching/recommendation service).

```
docker compose up --build
```
open http://localhost:3000

## what it does

Pick a few books you like and it recommends what to read next. There's
also a genre browse tab if you'd rather not pick books first, and a "more
like this" button on any book to see recommendations based on just that
one title.

Goodreads has millions of user-added tags per book but most of them are
junk (`to-read`, `owned`, `kindle`...). I wanted to see if I could build
something that actually uses the signal buried in there — real genre tags
plus reader rating patterns — instead of just sorting by popularity, which
is what most "recommended for you" sections actually do.

## the matching bit

Two models, blended:

- **content**: each book's top tags + author + title get turned into a
  TF-IDF vector, then squashed down to 100 numbers with SVD. This captures
  "what kind of book is this."
- **collaborative filtering**: the ~6 million ratings in the dataset get
  turned into a sparse matrix (which user rated which book how), also
  reduced with SVD, to 50 numbers per book. This captures "who else liked
  this, what else did they like."

Both vectors are normalized so comparing two books is just a dot product.
When you pick books for your shelf, I average their vectors into a "taste
profile" and score every other book against it. There's a slider in the UI
to control the blend — all the way to one side is basically "same genre,"
the other side is "same readers liked it," and the middle is a 50/50 mix.

Content-only recommenders end up just recommending the same author on
repeat. Ratings-only ones can't tell you *why* something matched. Doing
both together fixes both problems, and it's still simple enough that I can
explain exactly what happened for any given recommendation — no neural
net, no black box, just linear algebra on tags and ratings.

Genres work differently — no similarity math there, just a hand-picked
mapping from the messy raw tags to about 20 clean genre labels, sitting in
its own table. See `backend/app/build_genres.py` if you want to see how
that was done.

## how it's put together

frontend (nginx + React/TS) → backend (FastAPI) → db (Postgres), three
containers, one custom Docker network. Nginx serves the built frontend and
also proxies anything under `/api` straight to the backend container, so
the browser only ever talks to one address.

The recommendation model itself is separate from the database — it's a
couple of small numpy files baked into the backend image at build time
(see `preprocess.py`), so the running backend doesn't need
pandas/scikit-learn at all, just numpy. The database is Postgres, seeded
automatically the first time its container starts, from CSVs sitting in
`db/`.

More on the setup and the endpoint list: **[docs/SETUP.md](docs/SETUP.md)**.
Walkthrough of the app + a deeper technical breakdown:
**[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)**.

## data

[goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) — 10,000 books,
~6,000,000 ratings, scraped from Goodreads originally. Also on Kaggle under
the same author, though that copy is the older one with duplicate ratings —
the GitHub release is the current, cleaned-up version, which is what's
actually used here. Raw CSVs are committed in `backend/data/` so nothing
needs downloading at build time.

No external API keys anywhere — cover images come straight from URLs
already in the dataset.

## layout

```
book-recommender/
├── docker-compose.yml
├── docs/
├── db/                 postgres + seed data
├── backend/
│   ├── data/            raw csvs
│   └── app/
│       ├── preprocess.py     builds the recommendation vectors
│       ├── build_genres.py   builds the genre mapping
│       ├── recommender.py
│       ├── database.py
│       └── main.py
└── frontend/
    └── src/
        ├── api.ts
        ├── App.tsx
        └── components/
```

## stack

Python, FastAPI, numpy, psycopg2 on the backend. Postgres for storage.
React + TypeScript + Vite on the frontend, no UI framework, no jQuery.
Docker Compose to run it all.

Everything here — the recommender, the API, the schema, the frontend — was
written for this project. The dataset and the standard libraries (FastAPI,
React, scikit-learn) are the only outside pieces.
