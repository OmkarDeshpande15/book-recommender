export interface Book {
  book_id: number;
  title: string;
  authors: string;
  original_publication_year: number | null;
  average_rating: number;
  ratings_count: number;
  image_url: string;
  small_image_url: string;
}

export interface Recommendation extends Book {
  score: number;
}
