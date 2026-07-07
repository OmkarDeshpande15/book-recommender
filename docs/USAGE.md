# Usage Guide

Open **http://localhost:3000** after `docker compose up --build`.

There are two tabs at the top: **Taste match** and **Browse by genre**. Both
feed the same underlying recommender.

## 1. Taste match

1. Use the search box at the top to find a book by title or author (it
   searches as you type, with a short debounce so it's not firing a request
   on every keystroke).
2. Click a result to add it to **Your books**. Add a few — up to 10.
3. Adjust the **match style** slider if you want:
   - toward *same genre/tags* → recommendations lean on content similarity
     (tags, author)
   - toward *same readers liked* → recommendations lean on collaborative
     filtering (what readers of your picks also rated highly)
   - middle → a balanced blend (the default)
4. Click **Get recommendations**. Each result card shows a match percentage.

## 2. Browse by genre

Click the **Browse by genre** tab. Pick any genre chip (Fantasy, Mystery,
Romance, etc. — each shows how many books carry that tag) to see the
highest-rated books in that genre. You can add any of them to your shelf
from here too.

## 3. More like this

Any book card — in recommendations, browse results, or the popular-books
list — has a **more like this** button. Click it to see books similar to
that *one* specific book (this is the content+collaborative model scored
against a single book instead of your whole shelf). Use **back** to return
to where you were.

## Notes

- Match percentages are relative within a result set, not an absolute
  quality score.
- The popular books shown before you've added anything are just the
  highest rated-count books in the catalogue — a reasonable starting point
  if you don't know what to search for.
- Interactive API docs are at **http://localhost:8000/api/docs** if you've
  exposed the backend port (see INSTALL.md) and want to call it directly.
