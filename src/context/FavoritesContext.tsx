'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

/**
 * Favorites (wishlist). Guests keep the list in localStorage; signed-in
 * customers keep it in D1. On login the guest list is merged into the account
 * so nothing is lost when someone registers after browsing.
 */

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';
const STORAGE_KEY = 'indigo_favorites';

interface FavoritesContextType {
  favorites: string[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const mergedFor = useRef<string | null>(null);
  // Mirrors `favorites` synchronously. Reading state inside the toggle handler
  // would use the value captured when the callback was created, so two clicks
  // in the same tick both computed from the empty list and the first one was
  // lost. The ref is updated before the state, so rapid toggles compose.
  const current = useRef<string[]>([]);

  const commit = useCallback((next: string[]) => {
    current.current = next;
    setFavorites(next);
  }, []);

  // Guest list on first paint.
  useEffect(() => {
    commit(readLocal());
  }, [commit]);

  // On sign-in, merge the guest list into the account and adopt the result.
  // Runs once per user id -- re-running would be harmless but pointless.
  useEffect(() => {
    if (!token || !user) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === user.id) return;
    mergedFor.current = user.id;

    const guestIds = readLocal();
    fetch(`${API_URL}/account/favorites/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productIds: guestIds }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { productIds?: string[] } | null) => {
        if (!data?.productIds) return;
        commit(data.productIds.map(String));
        // The account is now the source of truth; clear the guest copy.
        localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {});
  }, [token, user, commit]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      const id = String(productId);
      const before = current.current;
      const isOn = before.includes(id);
      const next = isOn ? before.filter((f) => f !== id) : [...before, id];
      commit(next);

      if (!token) {
        writeLocal(next);
        return;
      }

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const request = isOn
        ? fetch(`${API_URL}/account/favorites/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
        : fetch(`${API_URL}/account/favorites`, { method: 'POST', headers, body: JSON.stringify({ productId: id }) });
      // Roll back just this id if the write fails, without discarding toggles
      // the customer made in the meantime.
      const rollback = () => {
        const now = current.current;
        commit(isOn ? (now.includes(id) ? now : [...now, id]) : now.filter((f) => f !== id));
      };
      request.then((r) => { if (!r.ok) rollback(); }).catch(rollback);
    },
    [token, commit],
  );

  const isFavorite = useCallback((productId: string) => favorites.includes(String(productId)), [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, count: favorites.length }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
};
