import type { Book } from "../types";

interface Props {
  books: Book[];
  onRemove: (bookId: number) => void;
  onGetRecommendations: () => void;
  loading: boolean;
}

export function Shelf({ books, onRemove, onGetRecommendations, loading }: Props) {
  return (
    <div className="shelf">
      <div className="shelf-header">
        <h2>Your books</h2>
        <span>{books.length}/10</span>
      </div>

      {books.length === 0 ? (
        <p className="shelf-empty">Search above and add a few books you like.</p>
      ) : (
        <ul className="shelf-list">
          {books.map((book) => (
            <li key={book.book_id} className="shelf-item">
              <span>{book.title}</span>
              <button onClick={() => onRemove(book.book_id)} aria-label={`Remove ${book.title}`}>
                x
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        className="btn-primary"
        onClick={onGetRecommendations}
        disabled={books.length === 0 || loading}
      >
        {loading ? "Loading..." : "Get recommendations"}
      </button>
    </div>
  );
}
