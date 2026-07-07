"""Builds db/book_genres.csv from the raw tag data.

Goodreads tags are mostly noise ("to-read", "owned", "kindle", "2015"...).
This maps a curated set of recognizable genre tags to clean labels and
keeps each book's top 3 by vote count. Not exhaustive -- ~20 genres, picked
by hand from the most common tags in the dataset (see the printed value
counts when you run this).

Run manually if the source data changes:
    python build_genres.py
Output feeds db/init.sql, same as db/books_clean.csv.
"""

from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_PATH = Path(__file__).resolve().parent.parent.parent / "db" / "book_genres.csv"

GENRE_MAP = {
    "fantasy": "Fantasy",
    "urban-fantasy": "Fantasy",
    "magic": "Fantasy",
    "science-fiction": "Science Fiction",
    "sci-fi": "Science Fiction",
    "young-adult": "Young Adult",
    "ya": "Young Adult",
    "teen": "Young Adult",
    "new-adult": "Young Adult",
    "classics": "Classics",
    "classic": "Classics",
    "romance": "Romance",
    "chick-lit": "Romance",
    "paranormal-romance": "Romance",
    "mystery": "Mystery",
    "non-fiction": "Nonfiction",
    "nonfiction": "Nonfiction",
    "historical-fiction": "Historical Fiction",
    "historical": "Historical Fiction",
    "horror": "Horror",
    "paranormal": "Horror",
    "supernatural": "Horror",
    "vampires": "Horror",
    "contemporary": "Contemporary",
    "childrens": "Children's",
    "children": "Children's",
    "children-s": "Children's",
    "children-s-books": "Children's",
    "picture-books": "Children's",
    "graphic-novels": "Graphic Novels",
    "graphic-novel": "Graphic Novels",
    "comics": "Graphic Novels",
    "manga": "Graphic Novels",
    "thriller": "Thriller",
    "suspense": "Thriller",
    "dystopian": "Dystopian",
    "dystopia": "Dystopian",
    "humor": "Humor",
    "adventure": "Adventure",
    "crime": "Crime",
    "memoir": "Biography & Memoir",
    "biography": "Biography & Memoir",
    "poetry": "Poetry",
    "philosophy": "Philosophy",
}


def main() -> None:
    tags = pd.read_csv(DATA_DIR / "tags.csv")
    book_tags = pd.read_csv(DATA_DIR / "book_tags.csv")
    books = pd.read_csv(DATA_DIR / "books.csv")[["book_id", "goodreads_book_id"]]

    merged = book_tags.merge(tags, on="tag_id").merge(books, on="goodreads_book_id")
    merged["genre"] = merged["tag_name"].map(GENRE_MAP)
    merged = merged.dropna(subset=["genre"])

    merged = merged.sort_values(["book_id", "count"], ascending=[True, False])
    top3 = merged.groupby("book_id").head(3)[["book_id", "genre"]].drop_duplicates()

    top3.to_csv(OUT_PATH, index=False)
    print(f"wrote {len(top3)} rows, {top3['book_id'].nunique()} books, to {OUT_PATH}")


if __name__ == "__main__":
    main()
