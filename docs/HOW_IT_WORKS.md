# How it works

## using it

Two tabs at the top — **Taste match** and **Browse by genre**.

Taste match: search for books, add a few to your shelf, hit get
recommendations. There's a slider for how much to weight genre/tag
similarity vs "readers who liked this also liked" — default is right in
the middle.

Browse by genre: skip the shelf entirely, just pick a genre chip and see
what's rated highest in it.

Either way, every result card has a "more like this" button that pivots
to item-to-item recommendations for that one specific book.

Match percentages only mean something relative to the other results in
that same list — they're not some absolute quality score.

## the data

`books.csv` (10k books), `ratings.csv` (~6M rows), `tags.csv` +
`book_tags.csv` (per-book Goodreads tags). All from goodbooks-10k, see the
main README for the source link.

Two tables end up in Postgres:

**books** — book_id, title, authors, publication year, average rating,
ratings count, cover image urls. Straight from `books.csv`, cleaned up a
bit (missing years/ratings filled with defaults).

**book_genres** — book_id + genre, up to 3 rows per book. This one doesn't
come straight from the dataset — Goodreads tags are mostly noise, so
`backend/app/build_genres.py` maps about 40 recognizable raw tags
(`sci-fi`, `ya`, `non-fiction`, `historical`...) onto ~20 clean labels and
keeps each book's top 3 by vote count. Everything else (`to-read`,
`kindle`, `owned`, year tags, etc.) gets dropped.

## the model

Not in the database — this lives as two small numpy arrays that get built
once by `preprocess.py` and baked straight into the backend Docker image.

**content vector, 100 numbers per book.** Take each book's top 12 tags
(by vote count) + author + title, mash them into one string, run
`TfidfVectorizer` on it (5000 max features, English stopwords stripped),
then `TruncatedSVD` down to 100 dimensions.

**collaborative vector, 50 numbers per book.** Build a sparse matrix out
of the ratings (deduped on user+book first, ~5.9M rows left, ~53k users x
10k books), transpose it so rows are books, run `TruncatedSVD` down to 50
dimensions.

Both get L2-normalized. That's the whole trick — once vectors are
normalized, a dot product between two of them equals their cosine
similarity, so comparing books is just multiplication, no separate
similarity library needed.

**recommend a shelf of books:**
```
profile_content  = average(content_vectors of shelf books)
profile_collab   = average(collab_vectors of shelf books)

score = alpha * (catalogue_content · profile_content)
      + (1-alpha) * (catalogue_collab · profile_collab)
```
sort descending, drop books already on the shelf, return top N. `alpha` is
whatever the UI slider is set to (0.5 default).

**"more like this" on one book** is the exact same code, just called with
a list of one book_id instead of several — the "profile" ends up being
that book's own vector, so it's plain item-item similarity.

**genre browsing** isn't similarity-based at all, it's a SQL join against
`book_genres` sorted by ratings count. No model involved.

## code, roughly

- `preprocess.py` — builds the two vector files, runs once at backend
  image build time
- `build_genres.py` — builds the genre table csv, run by hand when the
  mapping changes, not part of the docker build
- `recommender.py` — loads the vectors at startup, does the scoring math
- `database.py` — talks to postgres (psycopg2 + a small connection pool,
  retries on connect since the db container might still be booting)
- `main.py` — the FastAPI routes
- frontend `api.ts` is the only place that calls `fetch` — every
  component goes through it
- `App.tsx` holds the shelf state, the slider value, which tab is active,
  and the "similar to X" panel state

## why 10k books doesn't need a real vector database

At this size, scoring every book against a taste profile is one matrix
multiply — a few milliseconds. A dedicated vector db (FAISS, Pinecone,
whatever) would be solving a problem this project doesn't actually have.
If this were scaled up to, say, a few million books, that'd change —
approximate nearest neighbour search would start to matter at that point.
