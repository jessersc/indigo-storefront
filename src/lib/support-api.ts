/**
 * Client for the support widget: config (WhatsApp/support email), AI chat,
 * human escalation, and the "email us" contact form. Talks to the Worker.
 */

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

export interface SupportConfig {
  whatsappNumber: string;
  supportEmail: string;
}

export async function getSupportConfig(): Promise<SupportConfig> {
  const res = await fetch(`${API_URL}/config`);
  if (!res.ok) return { whatsappNumber: '', supportEmail: '' };
  const data = (await res.json()) as { config?: Record<string, string> };
  return {
    whatsappNumber: data.config?.whatsapp_number ?? '',
    supportEmail: data.config?.support_email ?? '',
  };
}

function authHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function sendChat(
  input: { threadId?: string; message: string; email?: string; name?: string; turnstileToken?: string },
  token?: string | null,
  // `reply` is null when a human agent has taken the thread over: the bot stays
  // quiet and the agent's answer arrives through polling instead.
): Promise<{
  threadId: string;
  reply: string | null;
  mode?: 'bot' | 'human';
  /** Which scripted intent answered, or 'unknown' when the model did. */
  intent?: string;
  escalated?: boolean;
}> {
  const res = await fetch(`${API_URL}/support/chat`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    // 429 is the per-conversation throttle (one message per 30s) or the per-IP
    // limit. Both carry a message meant for the customer, so show it rather
    // than a generic failure.
    if (res.status === 429 && data?.message) throw new Error(data.message);
    throw new Error(data?.message || 'No se pudo enviar el mensaje.');
  }
  return data;
}

export async function escalateChat(threadId: string, email?: string, token?: string | null): Promise<void> {
  await fetch(`${API_URL}/support/escalate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ threadId, email }),
  });
}

export interface ThreadMessage {
  id: string;
  sender: 'customer' | 'bot' | 'admin';
  body: string;
  created_at: string;
}

/**
 * Poll a thread for messages newer than `after`. Used while the chat panel is
 * open so an agent's reply appears without the customer refreshing.
 */
export async function pollThread(
  threadId: string,
  after?: string,
): Promise<{ messages: ThreadMessage[]; mode: 'bot' | 'human'; status: string } | null> {
  try {
    const url = new URL(`${API_URL}/support/threads/${encodeURIComponent(threadId)}/messages`);
    if (after) url.searchParams.set('after', after);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendContact(input: {
  name: string;
  email: string;
  message: string;
  /** Turnstile proof. Ignored by the Worker when Turnstile is unconfigured. */
  turnstileToken?: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/support/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data.message || 'No se pudo enviar el mensaje.');
}
