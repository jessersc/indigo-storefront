/**
 * Account-scoped calls beyond auth: profile, credentials, address book and
 * refund/replacement requests. Orders are fetched inline in the account page.
 *
 * Every endpoint here resolves the user from the bearer token server-side, so
 * nothing in these payloads identifies an account.
 */

import { ApiError, apiFetch, messageForCode, messageForStatus } from './api-error';

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

function authJson(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/**
 * Resolve, or throw an ApiError whose message is safe to render.
 *
 * The shared code map wins over the server's own string, so a code the Worker
 * sends bare (`rate_limited`, `unauthorized`) still reaches the customer as a
 * sentence rather than as an identifier.
 */
async function unwrap<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const code = typeof data?.error === 'string' ? data.error : '';
    throw new ApiError({
      code: code || `http_${res.status}`,
      status: res.status,
      message:
        messageForCode(code) ??
        (typeof data?.message === 'string' ? data.message : undefined) ??
        messageForStatus(res.status),
    });
  }
  return (data ?? {}) as T;
}

export interface AccountUser {
  id: string;
  email: string;
  email_verified: number;
  name: string | null;
  phone: string | null;
  cedula: string | null;
  role: string;
}

export async function updateProfile(
  input: { name?: string; phone?: string; cedula?: string },
  token: string,
): Promise<AccountUser> {
  const res = await apiFetch(`${API_URL}/account/profile`, {
    method: 'PATCH',
    headers: authJson(token),
    body: JSON.stringify(input),
  });
  const data = await unwrap<{ user: AccountUser }>(res);
  return data.user;
}

export async function changePassword(
  input: { currentPassword: string; newPassword: string },
  token: string,
): Promise<void> {
  const res = await apiFetch(`${API_URL}/account/password`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(input),
  });
  await unwrap(res);
}

/** Step 1: sends a code to the NEW address. The account email is unchanged. */
export async function requestEmailChange(
  input: { newEmail: string; currentPassword: string },
  token: string,
): Promise<void> {
  const res = await apiFetch(`${API_URL}/account/email/request`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(input),
  });
  await unwrap(res);
}

/** Step 2: returns a fresh token — the old one still claims the old email. */
export async function confirmEmailChange(
  input: { newEmail: string; code: string },
  token: string,
): Promise<{ token: string; user: AccountUser }> {
  const res = await apiFetch(`${API_URL}/account/email/confirm`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(input),
  });
  return unwrap<{ token: string; user: AccountUser }>(res);
}

export interface Address {
  id: string;
  label: string | null;
  recipient_name: string | null;
  phone: string | null;
  cedula: string | null;
  delivery_method: 'pickup-store' | 'delivery-home' | 'delivery-national';
  address_line: string | null;
  city: string | null;
  state: string | null;
  courier_name: string | null;
  courier_state: string | null;
  courier_office: string | null;
  instructions: string | null;
  is_default: number;
}

export async function getAddresses(token: string): Promise<Address[]> {
  const res = await apiFetch(`${API_URL}/account/addresses`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as { addresses: Address[] };
  return data.addresses ?? [];
}

export async function saveAddress(
  input: Partial<Address> & { id?: string },
  token: string,
): Promise<Address> {
  const { id, ...fields } = input;
  const res = await apiFetch(`${API_URL}/account/addresses${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: authJson(token),
    body: JSON.stringify(fields),
  });
  const data = await unwrap<{ address: Address }>(res);
  return data.address;
}

export async function deleteAddress(id: string, token: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/account/addresses/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await unwrap(res);
}

export interface RefundRequestEvent {
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  by_customer: boolean;
}

export interface RefundRequest {
  id: string;
  order_number: string;
  kind: 'refund' | 'replacement';
  reason: string | null;
  status: 'requested' | 'approved' | 'rejected' | 'completed';
  admin_note: string | null;
  created_at: string;
  /** Every step this request has been through, oldest first. */
  events: RefundRequestEvent[];
}

export async function getMyRefunds(token: string): Promise<RefundRequest[]> {
  const res = await apiFetch(`${API_URL}/account/refunds`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: RefundRequest[] };
  return data.items;
}

export async function createRefund(
  input: { orderNumber: string; kind: 'refund' | 'replacement'; reason: string },
  token: string,
): Promise<void> {
  const res = await apiFetch(`${API_URL}/account/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  await unwrap(res);
}
