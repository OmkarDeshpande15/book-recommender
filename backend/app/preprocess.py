"""
Builds the recommendation model from the raw goodbooks-10k CSVs.

Produces two files in artifacts/:
  content_factors.npy  - vector per book based on tags/author/title (TF-IDF -> SVD)
  collab_factors.npy   - vector per book based on the ratings matrix (SVD)

Runs once at Docker build time so the running container doesn't need
pandas/sklearn or the ~90MB of raw CSVs at request time.

Dataset: goodbooks-10k (https://github.com/zygmuntz/goodbooks-10k),
10,000 books + ~6M ratings from Goodreads.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "artifacts"

CONTENT_DIM = 100
COLLAB_DIM = 50
TOP_TAGS_PER_BOOK = 12


def load_books() -> pd.DataFrame:
    books = pd.read_csv(DATA_DIR / "books.csv")
    books["original_publication_year"] = (
        pd.to_numeric(books["original_publication_year"], errors="coerce")
        .fillna(0)
        .astype(int)
    )
    books["title"] = books["title"].fillna("Unknown title")
    books["authors"] = books["authors"].fillna("Unknown author")
    books["average_rating"] = pd.to_numeric(
        books["average_rating"], errors="coerce"
    ).fillna(0.0)
    books["image_url"] = books["image_url"].fillna("")
    return books


def build_tag_soup(books: pd.DataFrame) -> pd.Series:
    """Top tags + author + title per book, as one string for TF-IDF."""
    tags = pd.read_csv(DATA_DIR / "tags.csv")
    book_tags = pd.read_csv(DATA_DIR / "book_tags.csv")

    book_tags = book_tags.merge(tags, on="tag_id", how="left")
    book_tags = book_tags[book_tags["tag_name"].str.len() > 2]
    book_tags = book_tags.sort_values(["goodreads_book_id", "count"], ascending=[True, False])
    top_tags = book_tags.groupby("goodreads_book_id").head(TOP_TAGS_PER_BOOK)

    tag_soup = (
        top_tags.groupby("goodreads_book_id")["tag_name"]
        .apply(lambda s: " ".join(t.replace("-", " ") for t in s))
    )

    soup = books["goodreads_book_id"].map(tag_soup).fillna("")
    soup = (
        soup
        + " "
        + books["authors"].str.replace(",", " ", regex=False).str.lower()
        + " "
        + books["original_title"].fillna("").str.lower()
    )
    return soup


def build_content_factors(books: pd.DataFrame) -> np.ndarray:
    soup = build_tag_soup(books)
    vectorizer = TfidfVectorizer(max_features=5000, stop_words="english")
    tfidf = vectorizer.fit_transform(soup)

    n_components = min(CONTENT_DIM, tfidf.shape[1] - 1)
    svd = TruncatedSVD(n_components=n_components, random_state=42)
    factors = svd.fit_transform(tfidf)
    return normalize(factors).astype(np.float32)


def build_collab_factors(books: pd.DataFrame) -> np.ndarray:
    ratings = pd.read_csv(DATA_DIR / "ratings.csv")
    ratings = ratings.drop_duplicates(subset=["user_id", "book_id"])

    n_books = int(books["book_id"].max()) + 1
    n_users = int(ratings["user_id"].max()) + 1

    matrix = sparse.csr_matrix(
        (ratings["rating"], (ratings["user_id"], ratings["book_id"])),
        shape=(n_users, n_books),
    )
    item_matrix = matrix.T.tocsr()  # rows = books now

    svd = TruncatedSVD(n_components=COLLAB_DIM, random_state=42)
    factors_all = svd.fit_transform(item_matrix)

    factors = factors_all[books["book_id"].values]
    return normalize(factors).astype(np.float32)


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    print("Loading books...")
    books = load_books()

    print("Building content factors...")
    np.save(ARTIFACT_DIR / "content_factors.npy", build_content_factors(books))

    print("Building collaborative factors...")
    np.save(ARTIFACT_DIR / "collab_factors.npy", build_collab_factors(books))

    book_ids = books["book_id"].values.astype(np.int32)
    np.save(ARTIFACT_DIR / "book_ids.npy", book_ids)

    print(f"Done, wrote artifacts to {ARTIFACT_DIR}")


if __name__ == "__main__":
    main()
