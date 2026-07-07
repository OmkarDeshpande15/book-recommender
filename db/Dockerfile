FROM postgres:16-alpine

COPY init.sql /docker-entrypoint-initdb.d/10-init.sql
COPY books_clean.csv /docker-entrypoint-initdb.d/books_clean.csv
COPY book_genres.csv /docker-entrypoint-initdb.d/book_genres.csv
