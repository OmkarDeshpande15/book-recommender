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

  // debounce so we don't fire a request on every keystroke
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
    <div className="search-box" ref={containerRef}>
      <label className="search-label" htmlFor="book-search">
        Find a book you love
      </label>
      <input
        id="book-search"
        type="text"
        placeholder="Try “Dune”, “Jane Austen”, “Circe”…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && <span className="loading-dot" />}

      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((book) => {
            const already = selectedIds.has(book.book_id);
            return (
              <li key={book.book_id}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => {
                    onSelect(book);
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                >
                  {book.small_image_url && <img src={book.small_image_url} alt="" />}
                  <span>
                    <b>{book.title}</b>
                    <br />
                    {book.authors}
                  </span>
                  {already && <em>added</em>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
