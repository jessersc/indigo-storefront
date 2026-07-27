/**
 * Client wrappers for the Worker auth endpoints. Used by the storefront's
 * AuthContext. The token is a JWT issued by the Worker; the caller stores it
 * (localStorage) and passes it back as a Bearer token.
 */

import { postJson } from './api-error';

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

export interface AuthUser {
  id: string;
  email: string;
  email_verified: number;
  name: string | null;
  phone: string | null;
  cedula: string | null;
  auth_provider: string;
  role: 'customer' | 'admin';
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

/**
 * All auth calls go through postJson, which guarantees the thrown error carries
 * a message fit to render. The previous version passed the server's raw string
 * (or the bare code) straight through, so a CORS or offline failure showed the
 * browser's "Failed to fetch" on the login form.
 */
function post<T>(path: string, body: unknown): Promise<T> {
  return postJson<T>(`${API_URL}${path}`, body);
}

export const authApi = {
  register: (input: {
    email: string; password: string; name?: string; phone?: string; cedula?: string;
    // Cloudflare Turnstile proof. Ignored by the Worker when Turnstile is not
    // configured there.
    turnstileToken?: string;
  }) => post<{ ok: true; needsVerification: boolean }>('/auth/register', input),

  verify: (input: { email: string; code: string }) =>
    post<AuthResult>('/auth/verify', input),

  resendCode: (email: string) => post<{ ok: true }>('/auth/resend-code', { email }),

  login: (input: { email: string; password: string }) =>
    post<AuthResult>('/auth/login', input),

  googleLogin: (credential: string) => post<AuthResult>('/auth/google', { credential }),

  facebookLogin: (accessToken: string) => post<AuthResult>('/auth/facebook', { accessToken }),

  forgotPassword: (email: string, turnstileToken?: string) =>
    post<{ ok: true }>('/auth/forgot-password', { email, turnstileToken }),

  resetPassword: (input: { email: string; code: string; password: string }) =>
    post<{ ok: true }>('/auth/reset-password', input),

  /**
   * Guest checkout. Neither of these creates an account.
   *
   * `requestGuestCode` always answers ok, whether or not the address has an
   * account, so it cannot be used to find out which addresses are registered.
   * `verifyGuestCode` returns a short-lived token that lets the Worker accept
   * an order for that address — it proves control of the address only, and is
   * explicitly typed so it can never stand in for a session.
   */
  requestGuestCode: (email: string, turnstileToken?: string) =>
    post<{ ok: true }>('/guest/request-code', { email, turnstileToken }),

  verifyGuestCode: (input: { email: string; code: string }) =>
    post<{ ok: true; guestToken: string; expiresIn: number }>('/guest/verify-code', input),

  me: async (token: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const data = (await res.json()) as { user: AuthUser };
      return data.user;
    } catch {
      // Network/worker down: treat as unauthenticated rather than crashing.
      return null;
    }
  },
};
