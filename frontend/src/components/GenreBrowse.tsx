import { useEffect, useState } from "react";
import { getGenres, getBooksByGenre } from "../api";
import type { Book, Genre } from "../types";
import { BookCard } from "./BookCard";

interface Props {
  onAdd: (book: Book) => void;
  onSimilar: (book: Book) => void;
  selectedIds: Set<number>;
}

export function GenreBrowse({ onAdd, onSimilar, selectedIds }: Props) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getGenres()
      .then(setGenres)
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    getBooksByGenre(active, 12)
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [active]);

  return (
    <div>
      <div className="genre-chips">
        {genres.map((g) => (
          <button
            key={g.genre}
            className={g.genre === active ? "genre-chip active" : "genre-chip"}
            onClick={() => setActive(g.genre)}
          >
            {g.genre} <span>{g.book_count}</span>
          </button>
        ))}
      </div>

      {active && (
        <>
          <h2>{active}</h2>
          {loading ? (
            <p className="shelf-empty">Loading...</p>
          ) : (
            <div className="grid">
              {books.map((book) => (
                <BookCard
                  key={book.book_id}
                  book={book}
                  onAdd={onAdd}
                  onSimilar={onSimilar}
                  disabled={selectedIds.has(book.book_id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
