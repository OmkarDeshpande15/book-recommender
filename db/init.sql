-- runs on first container startup (postgres executes .sql files in
-- /docker-entrypoint-initdb.d/ automatically when the data dir is empty)

CREATE TABLE IF NOT EXISTS books (
    book_id                     INTEGER PRIMARY KEY,
    title                       TEXT NOT NULL,
    authors                     TEXT NOT NULL,
    original_publication_year   INTEGER,
    average_rating              REAL NOT NULL,
    ratings_count               INTEGER NOT NULL,
    image_url                   TEXT NOT NULL DEFAULT '',
    small_image_url             TEXT NOT NULL DEFAULT ''
);

COPY books (book_id, title, authors, original_publication_year, average_rating, ratings_count, image_url, small_image_url)
FROM '/docker-entrypoint-initdb.d/books_clean.csv'
WITH (FORMAT csv, HEADER true);

CREATE INDEX IF NOT EXISTS idx_books_ratings_count ON books (ratings_count DESC);

-- genre tags, curated from the raw goodreads shelf tags (see
-- backend/app/build_genres.py). many-to-many: a book can have up to 3.
CREATE TABLE IF NOT EXISTS book_genres (
    book_id  INTEGER NOT NULL REFERENCES books(book_id),
    genre    TEXT NOT NULL
);

COPY book_genres (book_id, genre)
FROM '/docker-entrypoint-initdb.d/book_genres.csv'
WITH (FORMAT csv, HEADER true);

CREATE INDEX IF NOT EXISTS idx_book_genres_genre ON book_genres (genre);
CREATE INDEX IF NOT EXISTS idx_book_genres_book_id ON book_genres (book_id);
