"use client";

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export function readClientCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || entry.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function writeClientCache<T>(key: string, value: T, ttlMs: number) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage can be unavailable in private contexts; fall back to live fetches.
  }
}

export function clearClientCache(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}

export async function cachedJson<T>(key: string, url: string, ttlMs: number, fallback: T): Promise<T> {
  const cached = readClientCache<T>(key);
  if (cached !== null) return cached;
  const resp = await fetch(url);
  if (!resp.ok) return fallback;
  const data = (await resp.json()) as T;
  writeClientCache(key, data, ttlMs);
  return data;
}
