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
      setError("Couldn't reach the backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Shelfmate</h1>
        <p>Add a few books you like, get recommendations based on tags and reader ratings.</p>
        <CatalogSearch onSelect={addToShelf} selectedIds={selectedIds} />
      </header>

      <main>
        <Shelf
          books={shelfBooks}
          onRemove={removeFromShelf}
          onGetRecommendations={handleRecommend}
          loading={loading}
        />

        {error && <p className="error">{error}</p>}

        {recommendations && (
          <section>
            <h2>Recommended for you</h2>
            <div className="grid">
              {recommendations.map((book) => (
                <BookCard key={book.book_id} book={book} />
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
                  disabled={selectedIds.has(book.book_id)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer>
        <p>data: goodbooks-10k</p>
      </footer>
    </div>
  );
}
