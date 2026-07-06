import type { Book } from "../types";

interface Props {
  books: Book[];
  onRemove: (bookId: number) => void;
  onGetRecommendations: () => void;
  loading: boolean;
}

// A small deterministic palette so spines look hand-shelved, not random.
const SPINE_COLORS = ["#8C5B3E", "#4E6C50", "#8A3B3B", "#3E5A78", "#7A5C8C", "#B08A2E"];

function spineColor(bookId: number): string {
  return SPINE_COLORS[bookId % SPINE_COLORS.length];
}

export function Shelf({ books, onRemove, onGetRecommendations, loading }: Props) {
  return (
    <div className="shelf">
      <div className="shelf__header">
        <h2 className="shelf__title">Your shelf</h2>
        <span className="shelf__count">{books.length} / 10</span>
      </div>

      {books.length === 0 ? (
        <p className="shelf__empty">
          Search above and add a few books you love. We'll find what to read next.
        </p>
      ) : (
        <div className="shelf__rail">
          {books.map((book) => (
            <button
              key={book.book_id}
              className="shelf__spine"
              style={{ background: spineColor(book.book_id) }}
              onClick={() => onRemove(book.book_id)}
              title={`Remove ${book.title}`}
            >
              <span className="shelf__spine-title">{book.title}</span>
              <span className="shelf__spine-remove" aria-hidden="true">
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        className="shelf__cta"
        onClick={onGetRecommendations}
        disabled={books.length === 0 || loading}
      >
        {loading ? "Reading your shelf…" : "Get recommendations"}
      </button>
    </div>
  );
}
