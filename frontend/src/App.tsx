import { useEffect, useState } from "react";
import { CatalogSearch } from "./components/CatalogSearch";
import { Shelf } from "./components/Shelf";
import { BookCard } from "./components/BookCard";
import { getPopularBooks, getRecommendations } from "./api";
import type { Book, Recommendation } from "./types";
import "./App.css";

export default function App() {
  const [shelfBooks, setShelfBooks] = useState<Book[]>([]);
  const [popular, setPopular] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        12
      );
      setRecommendations(recs);
    } catch {
      setError("Couldn't reach the recommendation service. Is the backend running?");
    } finally {
      setLoading(false);
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

      <main className="content">
        <Shelf
          books={shelfBooks}
          onRemove={removeFromShelf}
          onGetRecommendations={handleRecommend}
          loading={loading}
        />

        {error && <p className="error-banner">{error}</p>}

        {recommendations && (
          <section className="results">
            <h2 className="results__title">Picked for your shelf</h2>
            <div className="book-grid">
              {recommendations.map((book) => (
                <BookCard key={book.book_id} book={book} />
              ))}
            </div>
          </section>
        )}

        {!recommendations && popular.length > 0 && (
          <section className="results">
            <h2 className="results__title">Widely loved, good place to start</h2>
            <div className="book-grid">
              {popular.map((book) => (
                <BookCard
                  key={book.book_id}
                  book={book}
                  onAdd={addToShelf}
                  disabled={selectedIds.has(book.book_id)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>
          Built on the goodbooks-10k open dataset · content + collaborative-filtering
          hybrid matching
        </p>
      </footer>
    </div>
  );
}
