"""Request/response models."""

from pydantic import BaseModel, Field


class BookOut(BaseModel):
    book_id: int
    title: str
    authors: str
    original_publication_year: int | None = None
    average_rating: float
    ratings_count: int
    image_url: str
    small_image_url: str

    class Config:
        from_attributes = True


class RecommendationOut(BookOut):
    score: float = Field(..., description="Match score, 0-1")


class RecommendRequest(BaseModel):
    book_ids: list[int] = Field(..., min_length=1, max_length=10)
    top_n: int = Field(12, ge=1, le=50)
    alpha: float = Field(0.5, ge=0.0, le=1.0, description="1=content only, 0=collaborative only")
