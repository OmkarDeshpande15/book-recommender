import type { Book, Recommendation } from "./types";

// In production (Docker Compose) this is injected via nginx/env; in local
// `npm run dev` it falls back to the backend's default port.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function searchBooks(query: string, limit = 8): Promise<Book[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `${API_BASE}/api/books/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return handle<Book[]>(res);
}

export async function getPopularBooks(limit = 12): Promise<Book[]> {
  const res = await fetch(`${API_BASE}/api/books/popular?limit=${limit}`);
  return handle<Book[]>(res);
}

export async function getRecommendations(
  bookIds: number[],
  topN = 12,
  alpha = 0.5
): Promise<Recommendation[]> {
  const res = await fetch(`${API_BASE}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book_ids: bookIds, top_n: topN, alpha }),
  });
  return handle<Recommendation[]>(res);
}
