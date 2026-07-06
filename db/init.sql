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
