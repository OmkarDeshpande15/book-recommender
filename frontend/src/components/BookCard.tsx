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
    <article className="book-card">
      <div className="book-card__cover-wrap">
        {book.image_url ? (
          <img
            className="book-card__cover"
            src={book.image_url}
            alt={`Cover of ${book.title}`}
            loading="lazy"
          />
        ) : (
          <div className="book-card__cover book-card__cover--placeholder">
            {book.title.slice(0, 1)}
          </div>
        )}
        {rec && (
          <span className="book-card__match" title="Match strength">
            {Math.round(rec.score * 100)}% match
          </span>
        )}
      </div>
      <div className="book-card__body">
        <h3 className="book-card__title">{book.title}</h3>
        <p className="book-card__authors">{book.authors}</p>
        <p className="book-card__meta">
          {book.original_publication_year ? `${book.original_publication_year} · ` : ""}
          ★ {book.average_rating.toFixed(2)}
        </p>
      </div>
      {onAdd && (
        <button
          className="book-card__add"
          onClick={() => onAdd(book)}
          disabled={disabled}
        >
          {disabled ? "On your shelf" : "Add to shelf"}
        </button>
      )}
    </article>
  );
}
