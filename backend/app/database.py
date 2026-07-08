"""Talks to the Postgres container for book metadata.

Everything here is read-only (the data gets seeded once by db/init.sql),
so plain psycopg2 + a small connection pool is enough, no ORM.
"""

from __future__ import annotations

import os
import time
from contextlib import contextmanager
from typing import Iterable, Iterator

import psycopg2
import psycopg2.extras
from psycopg2 import pool

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://shelfmate:shelfmate@db:5432/shelfmate"
)

_COLUMNS = (
    "book_id, title, authors, original_publication_year, "
    "average_rating, ratings_count, image_url, small_image_url"
)

_pool: psycopg2.pool.SimpleConnectionPool | None = None


def init_pool(retries: int = 10, delay_seconds: float = 2.0) -> None:
    """Connect to Postgres, retrying a few times in case it's still starting up."""
    global _pool
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            _pool = psycopg2.pool.SimpleConnectionPool(1, 10, DATABASE_URL)
            return
        except psycopg2.OperationalError as exc:
            last_error = exc
            time.sleep(delay_seconds)
    raise RuntimeError(f"Could not connect to the database after {retries} attempts") from last_error


@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    if _pool is None:
        raise RuntimeError("Database pool not initialised -- call init_pool() at startup")
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


def search_books(query: str, limit: int = 10) -> list[dict]:
    """Case-insensitive substring search over title and author."""
    like = f"%{query}%"
    sql = f"""
        SELECT {_COLUMNS} FROM books
        WHERE title ILIKE %s OR authors ILIKE %s
        ORDER BY ratings_count DESC
        LIMIT %s
    """
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (like, like, limit))
            return cur.fetchall()


def get_books_by_ids(book_ids: Iterable[int]) -> dict[int, dict]:
    """Fetch multiple books by id, returned as a {book_id: row} map."""
    ids = list(book_ids)
    if not ids:
        return {}
    sql = f"SELECT {_COLUMNS} FROM books WHERE book_id = ANY(%s)"
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (ids,))
            rows = cur.fetchall()
    return {row["book_id"]: row for row in rows}


def get_popular_books(limit: int = 20) -> list[dict]:
    """A default/starter list of well-known books for the empty search state."""
    sql = f"""
        SELECT {_COLUMNS} FROM books
        ORDER BY ratings_count DESC
        LIMIT %s
    """
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (limit,))
            return cur.fetchall()


def get_genres() -> list[dict]:
    """All genres with how many books carry that tag, most common first."""
    sql = """
        SELECT genre, COUNT(*) AS book_count
        FROM book_genres
        GROUP BY genre
        ORDER BY book_count DESC
    """
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            return cur.fetchall()


def get_books_by_genre(genre: str, limit: int = 20) -> list[dict]:
    """Books tagged with a given genre, most-rated first."""
    sql = f"""
        SELECT {', '.join('b.' + c.strip() for c in _COLUMNS.split(','))}
        FROM books b
        JOIN book_genres g ON g.book_id = b.book_id
        WHERE g.genre = %s
        ORDER BY b.ratings_count DESC
        LIMIT %s
    """
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (genre, limit))
            return cur.fetchall()

