import { useEffect, useRef, useState } from "react";
import { searchBooks } from "../api";
import type { Book } from "../types";

interface Props {
  onSelect: (book: Book) => void;
  selectedIds: Set<number>;
}

export function CatalogSearch({ onSelect, selectedIds }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const books = await searchBooks(query, 8);
        setResults(books);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="catalog-search" ref={containerRef}>
      <label className="catalog-search__label" htmlFor="book-search">
        Find a book you love
      </label>
      <div className="catalog-search__input-wrap">
        <input
          id="book-search"
          type="text"
          className="catalog-search__input"
          placeholder="Try “Dune”, “Jane Austen”, “Circe”…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && <span className="catalog-search__spinner" aria-hidden="true" />}
      </div>

      {open && results.length > 0 && (
        <ul className="catalog-search__results">
          {results.map((book) => {
            const already = selectedIds.has(book.book_id);
            return (
              <li key={book.book_id}>
                <button
                  type="button"
                  className="catalog-search__result"
                  disabled={already}
                  onClick={() => {
                    onSelect(book);
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                >
                  {book.small_image_url ? (
                    <img src={book.small_image_url} alt="" className="catalog-search__thumb" />
                  ) : (
                    <span className="catalog-search__thumb catalog-search__thumb--placeholder" />
                  )}
                  <span className="catalog-search__result-text">
                    <span className="catalog-search__result-title">{book.title}</span>
                    <span className="catalog-search__result-authors">{book.authors}</span>
                  </span>
                  {already && <span className="catalog-search__badge">added</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
