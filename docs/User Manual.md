# User Manual

This document explains how to use the application once it is running.
For installation instructions, see [SETUP.md](SETUP.md). For an
explanation of how the recommendation logic works internally, see
[HOW_IT_WORKS.md](HOW_IT_WORKS.md).

## Before you start

The application must be running first:
```bash
docker compose up --build
```
Then open a browser and go to:
```
http://localhost:3000
```
See the main [README](../README.md), Sections 5–6, for prerequisites and
full setup instructions if this step has not been completed yet.

## Overview of the interface

The landing page has three parts:

1. A search bar at the top, used to find books.
2. Two mode tabs beneath the search bar: **Taste match** and
   **Browse by genre**.
3. A results area below, which changes depending on the selected mode.

*(screenshot: landing page — see docs/screenshots/, to be added)*

## Using Taste Match mode

This is the default mode when the application loads.

**Step 1 — Search for a book.**
Type into the search field labeled "Find a book you love." Results
appear automatically after a short pause in typing (the search is
debounced, so it does not send a request on every keystroke). Search
matches on both title and author.

**Step 2 — Add books to your shelf.**
Select a result from the dropdown to add it to "Your shelf," shown below
the search bar. Up to 10 books can be added. Each book on the shelf is
shown as a removable tag; select the "x" on any tag to remove it.


**Step 3 (optional) — Adjust the match-weight slider.**
Below the shelf is a slider labeled with the current match style
(genre-based, reader-based, or balanced). Moving it toward "same
genre/tags" weights the recommendation more heavily toward books with
similar tags and authors. Moving it toward "same readers liked" weights
it more heavily toward books that readers of your selected titles also
rated highly. The default, centered position weights both equally.

**Step 4 — Get recommendations.**
Select the "Get recommendations" button. A grid of result cards appears,
each showing the book's cover, title, author, and a match percentage.

*(screenshot: recommendation results grid — see docs/screenshots/, to be added)*

**Example.** Searching for and adding "The Hobbit," then selecting "Get
recommendations" with the slider at its default position, returns
results including *The Fellowship of the Ring*, *The Lord of the Rings*,
and other titles in the same genre and by the same author — books that
share both thematic content and a reader base with the input.

## Using Browse by Genre mode

Select the "Browse by genre" tab to switch modes.

**Step 1 — Select a genre.**
A row of genre chips is displayed (Fantasy, Mystery, Romance, and others
— 20 in total), each labeled with how many books in the catalogue carry
that genre.

**Step 2 — View results.**
Selecting a chip displays the highest-rated books carrying that genre
label. This does not require any books to be selected first and does not
use the recommendation model — it is a direct listing, sorted by rating
count.

*(screenshot: genre browse view — see docs/screenshots/, to be added)*

Books can be added to the shelf directly from this view using the "add"
button on each result card, which allows switching to Taste Match mode
afterward with those books already selected.

## Using "More like this"

Every result card, in any mode, includes a "more like this" button.

**Step 1.** Select "more like this" on any book.
**Step 2.** The view changes to show recommendations generated from that
one book only, labeled "More like '[book title]'."
**Step 3.** Select "back" (top-left of this view) to return to the
previous screen.

This is useful for exploring variations on a single title without
building a full taste profile on the shelf.

## Interpreting match percentages

Match percentages are relative to the other results within the same
response — they indicate ranking, not an absolute measure of quality.
A 90% match in one request and a 90% match in a different request (for
example, a different book selection, or a different slider position) are
not directly comparable to one another.

## Summary of controls

| Control | Location | Effect |
|---|---|---|
| Search field | Top of page | Finds books by title or author |
| Shelf tags | Below search field, Taste Match mode | Books currently selected as input |
| Match-weight slider | Below shelf | Controls content vs. collaborative-filtering blend |
| "Get recommendations" | Below slider | Runs the taste-based recommendation |
| Tab switcher | Below search field | Switches between Taste Match and Browse by Genre |
| Genre chips | Browse by Genre mode | Selects which genre's books to display |
| "more like this" | Every result card | Switches to single-book recommendations |
| "add" | Result cards outside the shelf | Adds that book to the shelf |
| "back" | Single-book recommendation view | Returns to the previous view |
