import { useEffect, useState } from "react";
import { CatalogSearch } from "./components/CatalogSearch";
import { Shelf } from "./components/Shelf";
import { BookCard } from "./components/BookCard";
import { GenreBrowse } from "./components/GenreBrowse";
import { getPopularBooks, getRecommendations, getSimilarBooks } from "./api";
import type { Book, Recommendation } from "./types";
import "./App.css";

type Mode = "taste" | "browse";

export default function App() {
  const [mode, setMode] = useState<Mode>("taste");
  const [shelfBooks, setShelfBooks] = useState<Book[]>([]);
  const [popular, setPopular] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [alpha, setAlpha] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [similarFor, setSimilarFor] = useState<Book | null>(null);
  const [similarResults, setSimilarResults] = useState<Recommendation[]>([]);

  useEffect(() => {
    getPopularBooks(10)
      .then(setPopular)
      .catch(() => setPopular([]));
  }, []);

  const selectedIds = new Set(shelfBooks.map((b) => b.book_id));

  function addToShelf(book: Book) {
    if (shelfBooks.length >= 10 || selectedIds.has(book.book_id)) return;
    setShelfBooks((prev) => [...prev, book]);
  }

  function removeFromShelf(bookId: number) {
    setShelfBooks((prev) => prev.filter((b) => b.book_id !== bookId));
  }

  async function handleRecommend() {
    setLoading(true);
    setError(null);
    try {
      const recs = await getRecommendations(
        shelfBooks.map((b) => b.book_id),
        12,
        alpha
      );
      setRecommendations(recs);
    } catch {
      setError("Couldn't reach the backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleSimilar(book: Book) {
    setSimilarFor(book);
    setSimilarResults([]);
    try {
      const results = await getSimilarBooks(book.book_id, 12);
      setSimilarResults(results);
    } catch {
      setError("Couldn't load similar books.");
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="hero__eyebrow">A matching service for readers</p>
        <h1 className="hero__title">Shelfmate</h1>
        <p className="hero__subtitle">
          Tell us a few books you've loved. We'll read the room — genres, tone, the
          company they keep on other people's shelves — and hand you what's next.
        </p>
        <CatalogSearch onSelect={addToShelf} selectedIds={selectedIds} />
      </header>

      <nav className="tabs">
        <button className={mode === "taste" ? "active" : ""} onClick={() => setMode("taste")}>
          Taste match
        </button>
        <button className={mode === "browse" ? "active" : ""} onClick={() => setMode("browse")}>
          Browse by genre
        </button>
      </nav>

      <main className="content">
        {similarFor && (
          <section className="similar-panel">
            <button className="back-link" onClick={() => setSimilarFor(null)}>
              &larr; back
            </button>
            <h2>More like "{similarFor.title}"</h2>
            <div className="grid">
              {similarResults.map((book) => (
                <BookCard key={book.book_id} book={book} onSimilar={handleSimilar} />
              ))}
            </div>
          </section>
        )}

        {!similarFor && mode === "taste" && (
          <>
            <Shelf
              books={shelfBooks}
              onRemove={removeFromShelf}
              onGetRecommendations={handleRecommend}
              loading={loading}
              alpha={alpha}
              onAlphaChange={setAlpha}
            />

            {error && <p className="error">{error}</p>}

            {recommendations && (
              <section>
                <h2>Recommended for you</h2>
                <div className="grid">
                  {recommendations.map((book) => (
                    <BookCard key={book.book_id} book={book} onSimilar={handleSimilar} />
                  ))}
                </div>
              </section>
            )}

            {!recommendations && popular.length > 0 && (
              <section>
                <h2>Popular books</h2>
                <div className="grid">
                  {popular.map((book) => (
                    <BookCard
                      key={book.book_id}
                      book={book}
                      onAdd={addToShelf}
                      onSimilar={handleSimilar}
                      disabled={selectedIds.has(book.book_id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {!similarFor && mode === "browse" && (
          <GenreBrowse onAdd={addToShelf} onSimilar={handleSimilar} selectedIds={selectedIds} />
        )}
      </main>

      <footer>
        <p>data: goodbooks-10k</p>
      </footer>
    </div>
  );
}
