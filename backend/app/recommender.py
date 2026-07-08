"""Recommendation engine.

Loads the two precomputed vectors produced by preprocess.py (content-based
and collaborative-filtering) and scores books against a user's selection.

Both vectors are L2-normalized, so a dot product between any two rows is
equivalent to their cosine similarity. Scoring the entire catalogue is
therefore a single matrix multiplication, which is fast enough at this
scale (10,000 books) without a dedicated vector-search library.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "artifacts"


class Recommender:
    def __init__(self) -> None:
        self.content_factors: np.ndarray = np.load(ARTIFACT_DIR / "content_factors.npy")
        self.collab_factors: np.ndarray = np.load(ARTIFACT_DIR / "collab_factors.npy")
        self.book_ids: np.ndarray = np.load(ARTIFACT_DIR / "book_ids.npy")
        self._index_of = {int(bid): i for i, bid in enumerate(self.book_ids)}

    def known_ids(self, book_ids: list[int]) -> list[int]:
        """Drop any ids we don't have vectors for."""
        return [bid for bid in book_ids if bid in self._index_of]

    def recommend(
        self, liked_book_ids: list[int], top_n: int = 12, alpha: float = 0.5
    ) -> list[tuple[int, float]]:
        """Return (book_id, score) pairs, best matches first.

        Averages the vectors of the liked books into one "profile", then
        scores every book in the catalogue against it using a weighted mix
        of content similarity and collaborative similarity. alpha=1 is pure
        content, alpha=0 is pure collaborative, 0.5 is even.
        """
        liked_idx = [self._index_of[bid] for bid in liked_book_ids if bid in self._index_of]
        if not liked_idx:
            return []

        content_profile = self.content_factors[liked_idx].mean(axis=0)
        collab_profile = self.collab_factors[liked_idx].mean(axis=0)

        content_scores = self.content_factors @ content_profile
        collab_scores = self.collab_factors @ collab_profile
        scores = alpha * content_scores + (1 - alpha) * collab_scores

        exclude = set(liked_idx)
        order = np.argsort(-scores)

        results: list[tuple[int, float]] = []
        for i in order:
            if i in exclude:
                continue
            score = float(scores[i])
            # scores land roughly in [-1, 1], rescale to [0, 1] for display
            results.append((int(self.book_ids[i]), max(0.0, min(1.0, (score + 1) / 2))))
            if len(results) >= top_n:
                break
        return results


recommender = Recommender()
