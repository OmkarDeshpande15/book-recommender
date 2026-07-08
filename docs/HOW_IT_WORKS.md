# How the Application Works

Supplementary detail to the "How to use the application" and "Technical
explanation" sections of the main README.

## Usage walkthrough

The application presents two modes, selected by the tabs beneath the
search bar: **Taste match** and **Browse by genre**.

### Taste-match mode

**Example:** searching for and adding "The Hobbit" to the shelf, then
selecting "Get recommendations" with the match-weight slider at its
default (0.5) position, returns results including *The Fellowship of the
Ring*, *The Lord of the Rings*, and other Tolkien and epic-fantasy
titles, each with a match percentage.

Moving the slider toward "same genre/tags" increases the weight given to
the content-based model (tags, author, title similarity); moving it
toward "same readers liked" increases the weight given to the
collaborative-filtering model (rating-pattern similarity). This directly
controls the `alpha` parameter described in the README's technical
section.

Match percentages are relative to the other results within the same
response, not an absolute quality measure — a 95% match in one request
and a 95% match in a different request are not directly comparable to
each other.

### Genre-browse mode

Selecting a genre chip (for example, "Mystery") queries the database
directly for the highest-rated-count books carrying that genre label, and
displays them without requiring the user to select any books first. This
mode does not use the recommendation model at all — see "Genre browsing"
below.

### Single-book recommendations

The "more like this" button, present on every result card regardless of
mode, calls the same recommendation logic used for taste-match mode, but
with a single book as the input rather than an entire shelf. The result
is standard item-to-item similarity: recommendations based on that one
book's own content and collaborative-filtering vectors.

## Data layer

Two tables exist in PostgreSQL, both seeded automatically from CSV files
when the `db` container starts for the first time (see `db/init.sql`):

**`books`**

| Column | Type | Description |
|---|---|---|
| book_id | INTEGER (primary key) | |
| title | TEXT | |
| authors | TEXT | |
| original_publication_year | INTEGER | |
| average_rating | REAL | |
| ratings_count | INTEGER | |
| image_url | TEXT | Full-size cover image URL, from the source dataset |
| small_image_url | TEXT | Thumbnail cover image URL |

**`book_genres`** (many-to-many; each book has at most 3 rows)

| Column | Type | Description |
|---|---|---|
| book_id | INTEGER (references books) | |
| genre | TEXT | One of 20 curated genre labels |

## The recommendation model

The recommendation model is not part of the relational database. It
consists of two NumPy arrays, computed once by `backend/app/preprocess.py`
at backend Docker image build time, and loaded into memory when the
backend process starts:

- `content_factors.npy` — shape (10000, 100). Each row is a book's
  content vector, derived from its top 12 tags, author, and title.
- `collab_factors.npy` — shape (10000, 50). Each row is a book's
  collaborative-filtering vector, derived from the ratings matrix.

Both arrays are L2-normalized, meaning the dot product of any two rows is
mathematically equivalent to the cosine similarity between them. This
allows the entire catalogue to be scored against a query vector using a
single matrix-vector multiplication, without a dedicated similarity
search library.

**Scoring logic** (implemented in `backend/app/recommender.py`):

```python
content_profile = mean(content_factors[selected_book_indices])
collab_profile  = mean(collab_factors[selected_book_indices])

content_scores = content_factors @ content_profile
collab_scores  = collab_factors @ collab_profile

final_scores = alpha * content_scores + (1 - alpha) * collab_scores
```

Results are sorted in descending order of `final_scores`, books already
present in the query are excluded, and the top N (default 12) are
returned with their scores rescaled from [−1, 1] to [0, 1] for display.

## Genre browsing

Genre browsing does not use the recommendation model. It is a
conventional SQL query:

```sql
SELECT b.* FROM books b
JOIN book_genres g ON g.book_id = b.book_id
WHERE g.genre = %s
ORDER BY b.ratings_count DESC
LIMIT %s
```

The genre labels themselves are not derived automatically from the
dataset; they were curated by hand in `backend/app/build_genres.py`,
because the majority of raw Goodreads tags are not genre indicators
(examples of discarded tags: `to-read`, `owned`, `kindle`, `2015`, and
similar status/logistics tags). Approximately 40 recognizable genre-tag
variants were mapped onto 20 clean labels; each book's top 3 genres by
tag-vote count were retained.

## Component responsibilities

| File | Responsibility |
|---|---|
| `backend/app/main.py` | FastAPI route definitions |
| `backend/app/recommender.py` | Loads the model vectors at startup; performs the scoring logic described above |
| `backend/app/database.py` | PostgreSQL access via psycopg2, with a connection pool and retry-on-connect logic |
| `backend/app/preprocess.py` | Builds the two model vector files; runs once, at backend image build time |
| `backend/app/build_genres.py` | Builds the genre-mapping CSV; run manually if the mapping is changed, not part of the Docker build |
| `frontend/src/api.ts` | Typed HTTP client; the sole point of contact between the frontend and the backend API |
| `frontend/src/App.tsx` | Top-level application state (selected books, active mode, slider value, single-book view) |

## Design note: catalogue size and similarity search

At 10,000 books, scoring the entire catalogue against a query vector is
a single matrix multiplication, completing in a few milliseconds. A
dedicated vector-search library or database (for example, FAISS) was
deliberately not used, since it would add complexity without a
corresponding performance benefit at this scale. Such a library would
become appropriate if the catalogue size increased by several orders of
magnitude.
