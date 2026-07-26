/**
 * Turning any failure into something a customer can act on.
 *
 * Three things go wrong when calling the Worker, and they need different words:
 *
 *   1. The request never arrives -- offline, DNS, CORS, the Worker is down.
 *      `fetch` rejects with a TypeError whose message is "Failed to fetch".
 *      That string was reaching the login form verbatim, which tells a customer
 *      nothing and looks broken.
 *   2. The request arrives and the server says no. The Worker returns a stable
 *      `error` code; some carry a Spanish `message`, many do not, and without a
 *      map the UI ends up printing "rate_limited" at the customer.
 *   3. The request arrives and something upstream returns HTML (a 502 page).
 *      `res.json()` throws, so the status is all we have to go on.
 *
 * Spanish here is deliberately unaccented, matching the Worker's own strings
 * ("Codigo invalido o vencido.") so the two sources read as one voice.
 */

/** Seconds before a request is abandoned. Long enough for a cold Worker start. */
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  /** Stable machine code from the Worker, e.g. "invalid_credentials". */
  readonly code: string;
  readonly status: number;
  /** True when the request never reached the server -- worth a retry. */
  readonly isNetwork: boolean;
  /** Set by /auth/login when the account exists but the email is unconfirmed. */
  readonly needsVerification: boolean;

  constructor(opts: {
    code: string;
    status?: number;
    message: string;
    isNetwork?: boolean;
    needsVerification?: boolean;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.code = opts.code;
    this.status = opts.status ?? 0;
    this.isNetwork = opts.isNetwork ?? false;
    this.needsVerification = opts.needsVerification ?? false;
  }
}

/**
 * Worker error code -> customer-facing Spanish.
 *
 * Anything the Worker can return should have an entry, including the codes it
 * sends without a message of their own. A missing entry is not fatal -- the
 * server's message or a generic line is used -- but it means a customer may
 * see a bare code.
 */
const MESSAGES: Record<string, string> = {
  // Credentials. Deliberately identical for "no such account" and "wrong
  // password": distinguishing them tells an attacker which emails are
  // registered, and the Worker already refuses to make that distinction.
  invalid_credentials: 'Correo o contrasena incorrectos.',
  unverified: 'Verifica tu correo antes de iniciar sesion. Te enviamos un codigo.',
  unauthorized: 'Tu sesion expiro. Inicia sesion de nuevo.',

  // Registration and codes.
  email_taken: 'Ya existe una cuenta con ese correo. Inicia sesion o recupera tu contrasena.',
  invalid_code: 'Codigo invalido o vencido. Pide uno nuevo.',
  invalid_input: 'Revisa los datos ingresados e intenta de nuevo.',
  not_found: 'No encontramos esa cuenta.',

  // Account settings.
  wrong_password: 'La contrasena actual no es correcta.',
  invalid_password: 'La contrasena debe tener al menos 8 caracteres.',
  invalid_email: 'Ese correo no es valido.',
  invalid_cedula: 'Esa cedula no es valida.',
  same_email: 'Ese ya es tu correo actual.',
  no_fields: 'No hay cambios para guardar.',
  forbidden: 'No tienes permiso para hacer eso.',
  internal_error: 'Tuvimos un problema procesando tu solicitud. Intenta de nuevo en unos minutos.',

  // Abuse controls. The Turnstile rejection is `failed_challenge`, not the
  // `turnstile_failed` you might expect -- verified against the live API.
  rate_limited: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
  failed_challenge: 'No pudimos verificar que eres una persona. Recarga la pagina e intenta de nuevo.',
  too_fast: 'Vas muy rapido. Espera unos segundos e intenta de nuevo.',

  // Social sign-in. A customer cannot act on the difference between a bad
  // token, a mismatched audience and a failed profile fetch, so they collapse
  // into one message per provider.
  not_configured: 'Ese metodo de inicio de sesion no esta disponible por ahora.',
  invalid_google_token: 'No pudimos validar tu cuenta de Google. Intenta de nuevo.',
  aud_mismatch: 'No pudimos validar tu cuenta de Google. Intenta de nuevo.',
  unverified_google_email: 'Tu correo de Google no esta verificado. Verificalo con Google primero.',
  invalid_facebook_token: 'No pudimos validar tu cuenta de Facebook. Intenta de nuevo.',
  token_app_mismatch: 'No pudimos validar tu cuenta de Facebook. Intenta de nuevo.',
  profile_failed: 'No pudimos leer tu perfil de Facebook. Intenta de nuevo.',
  no_email: 'Tu cuenta no tiene un correo asociado. Usa otro metodo de registro.',

  // Local, never sent by the Worker.
  network: 'No pudimos conectar con el servidor. Revisa tu conexion e intenta de nuevo.',
  timeout: 'La solicitud tardo demasiado. Intenta de nuevo.',
  server: 'Tuvimos un problema procesando tu solicitud. Intenta de nuevo en unos minutos.',
};

/** Generic line for a status when there is no code to go on. */
function messageForStatus(status: number): string {
  if (status >= 500) return MESSAGES.server;
  if (status === 429) return MESSAGES.rate_limited;
  if (status === 401 || status === 403) return MESSAGES.unauthorized;
  if (status === 404) return MESSAGES.not_found;
  return 'No pudimos completar la accion. Intenta de nuevo.';
}

/**
 * POST JSON and resolve, or throw an ApiError carrying a message safe to render.
 * Never rejects with a raw TypeError.
 */
export async function postJson<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
  // AbortSignal.timeout is not in every browser the storefront targets, so the
  // controller is wired by hand.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    // An abort surfaces here too, and reads as a timeout rather than a failure
    // the customer caused.
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError({
      code: aborted ? 'timeout' : 'network',
      message: aborted ? MESSAGES.timeout : MESSAGES.network,
      isNetwork: true,
    });
  } finally {
    clearTimeout(timer);
  }

  // A gateway error returns HTML, so this must tolerate a parse failure.
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    const code = typeof data?.error === 'string' ? data.error : '';
    // Prefer our mapping over the server's message: the Worker's strings are
    // aimed at the API, ours at the person reading the form.
    const message =
      MESSAGES[code] ??
      (typeof data?.message === 'string' ? data.message : undefined) ??
      messageForStatus(res.status);
    throw new ApiError({
      code: code || `http_${res.status}`,
      status: res.status,
      message,
      needsVerification: data?.needsVerification === true,
    });
  }

  return (data ?? {}) as T;
}

/**
 * `fetch` that turns a transport failure into an ApiError instead of a raw
 * TypeError, and applies the same timeout. For call sites that handle the
 * Response themselves (see account-api's `unwrap`) rather than wanting the
 * parsed body back from postJson.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError({
      code: aborted ? 'timeout' : 'network',
      message: aborted ? MESSAGES.timeout : MESSAGES.network,
      isNetwork: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Customer-facing text for a Worker error code, if one is known. */
export function messageForCode(code: string | undefined): string | undefined {
  return code ? MESSAGES[code] : undefined;
}

export { messageForStatus };

/**
 * Message for anything thrown in a form handler. Unknown throwables collapse to
 * a generic line -- a raw TypeError or a stack trace must never reach the UI.
 */
export function errorMessage(err: unknown, fallback = 'No pudimos completar la accion.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) {
    // "Failed to fetch" / "NetworkError when attempting to fetch resource" and
    // friends: browser-specific wording for the same thing.
    if (/failed to fetch|networkerror|load failed/i.test(err.message)) return MESSAGES.network;
    if (err.name === 'AbortError') return MESSAGES.timeout;
  }
  return fallback;
}
