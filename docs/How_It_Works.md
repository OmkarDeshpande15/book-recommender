# How the Application Works

Technical explanation of the recommendation logic, data layer, and code
structure. For step-by-step usage instructions, see
[User Manual.md](User%Manual.md). For installation, see [Installation_Guide.md](Installation_Guide.md).

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
