"""FastAPI app for the book recommender.

Routes:
  GET  /api/books/search       - search by title/author
  GET  /api/books/popular      - starter list for the empty state
  GET  /api/books/{id}/similar - books similar to one specific book
  GET  /api/genres             - list of genres with book counts
  GET  /api/books/by-genre     - books tagged with a given genre
  POST /api/recommend          - the taste-profile matching endpoint
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import database
from .recommender import recommender
from .schemas import BookOut, RecommendationOut, RecommendRequest


@asynccontextmanager
async def lifespan(app: FastAPI):
    # connect to postgres on startup (retries if it's not ready yet)
    database.init_pool()
    yield


app = FastAPI(
    title="Book Recommender API",
    description=(
        "Content + collaborative-filtering hybrid book recommendation service, "
        "built on the goodbooks-10k open dataset."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# frontend is a separate container/origin, needs CORS opened up
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _row_to_book(row: dict) -> BookOut:
    return BookOut(**row)


@app.get("/api/health")
def health() -> dict:
    """Liveness + database-reachability check, used by Docker healthchecks."""
    try:
        database.get_popular_books(limit=1)
        db_status = "ok"
    except Exception:
        db_status = "unreachable"
    return {"status": "ok", "database": db_status}


@app.get("/api/books/search", response_model=list[BookOut])
def search_books(
    q: str = Query(..., min_length=1, description="Title or author substring"),
    limit: int = Query(10, ge=1, le=50),
) -> list[BookOut]:
    """Search books by title or author, for the autocomplete/search box."""
    rows = database.search_books(q, limit=limit)
    return [_row_to_book(r) for r in rows]


@app.get("/api/books/popular", response_model=list[BookOut])
def popular_books(limit: int = Query(20, ge=1, le=50)) -> list[BookOut]:
    """A default set of popular books, shown before the user has picked any."""
    rows = database.get_popular_books(limit=limit)
    return [_row_to_book(r) for r in rows]


@app.get("/api/books/{book_id}/similar", response_model=list[RecommendationOut])
def similar_books(book_id: int, limit: int = Query(12, ge=1, le=50)) -> list[RecommendationOut]:
    """Books similar to one specific book (content + collaborative blend)."""
    if book_id not in recommender.known_ids([book_id]):
        raise HTTPException(status_code=404, detail=f"Unknown book_id: {book_id}")

    ranked = recommender.recommend([book_id], top_n=limit)
    book_rows = database.get_books_by_ids([bid for bid, _ in ranked])

    results: list[RecommendationOut] = []
    for bid, score in ranked:
        row = book_rows.get(bid)
        if row is None:
            continue
        results.append(RecommendationOut(**dict(row), score=round(score, 4)))
    return results


@app.get("/api/genres")
def genres() -> list[dict]:
    """All genres available to browse, with how many books carry each one."""
    return database.get_genres()


@app.get("/api/books/by-genre", response_model=list[BookOut])
def books_by_genre(
    genre: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
) -> list[BookOut]:
    """Books tagged with a given genre, most-rated first."""
    rows = database.get_books_by_genre(genre, limit=limit)
    return [_row_to_book(r) for r in rows]


@app.post("/api/recommend", response_model=list[RecommendationOut])
def recommend(payload: RecommendRequest) -> list[RecommendationOut]:
    """Given a list of books the user likes, return the best-matching others."""
    known = recommender.known_ids(payload.book_ids)
    if not known:
        raise HTTPException(
            status_code=404,
            detail="None of the provided book_ids were found in the catalogue.",
        )

    ranked = recommender.recommend(known, top_n=payload.top_n, alpha=payload.alpha)
    book_rows = database.get_books_by_ids([bid for bid, _ in ranked])

    results: list[RecommendationOut] = []
    for book_id, score in ranked:
        row = book_rows.get(book_id)
        if row is None:
            continue
        results.append(RecommendationOut(**dict(row), score=round(score, 4)))
    return results
