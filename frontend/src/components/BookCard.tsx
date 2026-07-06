import type { Book, Recommendation } from "../types";

interface Props {
  book: Book | Recommendation;
  onAdd?: (book: Book) => void;
  disabled?: boolean;
}

function isRecommendation(book: Book | Recommendation): book is Recommendation {
  return "score" in book;
}

export function BookCard({ book, onAdd, disabled }: Props) {
  const rec = isRecommendation(book) ? book : null;

  return (
    <div className="card">
      <div className="card-cover">
        {book.image_url ? (
          <img src={book.image_url} alt={book.title} loading="lazy" />
        ) : (
          <div className="card-cover-placeholder">{book.title.slice(0, 1)}</div>
        )}
        {rec && <span className="card-score">{Math.round(rec.score * 100)}%</span>}
      </div>
      <div className="card-body">
        <h3>{book.title}</h3>
        <p className="card-authors">{book.authors}</p>
        <p className="card-meta">
          {book.original_publication_year ? `${book.original_publication_year} · ` : ""}
          {book.average_rating.toFixed(2)} stars
        </p>
      </div>
      {onAdd && (
        <button onClick={() => onAdd(book)} disabled={disabled}>
          {disabled ? "added" : "add"}
        </button>
      )}
    </div>
  );
}
