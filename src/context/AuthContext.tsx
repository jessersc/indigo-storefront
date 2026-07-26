'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, type AuthUser } from '../lib/auth-api';

/**
 * Storefront auth state. The Worker is the auth authority; here we just hold the
 * JWT (persisted in localStorage) and the hydrated user. On mount we validate
 * the stored token via /auth/me so a revoked/expired token logs the user out.
 */

const TOKEN_KEY = 'indigo_auth_token';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  setSession: (result: { token: string; user: AuthUser }) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    authApi
      .me(stored)
      .then((u) => {
        if (u) setUser(u);
        else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const setSession = useCallback((result: { token: string; user: AuthUser }) => {
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const u = await authApi.me(token);
    setUser(u);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, setSession, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
