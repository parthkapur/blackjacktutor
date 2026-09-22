"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const notify = () => listeners.forEach((l) => l());

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  notify();
}

/**
 * localStorage-backed state. Server/first paint renders `initial`; the client snapshot takes over after hydration.
 * Object values are shallow-merged over `initial` so adding fields later doesn't break old saves.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void, boolean] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const value = useMemo<T>(() => {
    if (raw == null) return initial;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...initial, ...parsed } : parsed;
    } catch {
      return initial;
    }
  }, [raw, initial]);

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const prev = readStorage<T>(key, initial);
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      writeStorage(key, next);
    },
    [key, initial],
  );
  return [value, set, ready];
}
