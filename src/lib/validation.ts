/**
 * Field validation shared by checkout and the account forms.
 *
 * Every rule here is also enforced in the Worker (orders.ts, auth.ts). This
 * copy exists to tell the customer what is wrong before they submit; it is not
 * a security boundary, because anything running in a browser can be bypassed.
 *
 * Each function returns a Spanish message, or null when the value is fine --
 * so a form can do `const err = validateEmail(v); if (err) ...`.
 *
 * Spanish is unaccented to match the rest of the storefront's copy.
 */

/**
 * Deliberately not one of the RFC-5322 monsters. Those accept addresses no mail
 * server will route and reject ones that work; the real test is whether the
 * verification code arrives. This catches the mistakes people actually make --
 * a missing @, a missing dot, a trailing comma, an internal space.
 */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-zA-Z]{2,}$/;

export function validateEmail(value: string): string | null {
  const v = (value ?? '').trim();
  if (!v) return 'El correo es requerido.';
  if (v.length > 254) return 'Ese correo es demasiado largo.';
  if (!EMAIL_RE.test(v)) return 'Escribe un correo valido, por ejemplo nombre@dominio.com';
  return null;
}

/**
 * Cedula: digits only, 6 to 12 of them.
 *
 * A leading V-/E- is accepted on input and stripped, because people type it out
 * of habit, but only the digits are stored. Nothing else is allowed through --
 * dots and dashes in an identity number make it impossible to match reliably
 * against an order later.
 */
export function normalizeCedula(value: string): string {
  return (value ?? '').trim().replace(/^[VvEeJjGg][-\s]?/, '').replace(/[.\s-]/g, '');
}

export function validateCedula(value: string): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return 'La cedula es requerida.';
  const v = normalizeCedula(raw);
  if (!/^\d+$/.test(v)) return 'La cedula debe tener solo numeros.';
  if (v.length < 6 || v.length > 12) return 'La cedula debe tener entre 6 y 12 numeros.';
  return null;
}

/**
 * Phone in international form: a country code and 8-15 digits total (E.164).
 *
 * The country code is required rather than assumed. A courier or a WhatsApp
 * message needs the full number, and a local-format number silently fails to
 * reach anyone once it leaves the country it was typed in.
 */
export function normalizePhone(value: string): string {
  const v = (value ?? '').trim().replace(/[\s().-]/g, '');
  // 00 is the other way people write an international prefix.
  return v.startsWith('00') ? `+${v.slice(2)}` : v;
}

export function validatePhone(value: string, { required = true } = {}): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return required ? 'El telefono es requerido.' : null;

  const v = normalizePhone(raw);
  if (!v.startsWith('+')) {
    return 'Incluye el codigo del pais, por ejemplo +58 412 1234567';
  }
  const digits = v.slice(1);
  if (!/^\d+$/.test(digits)) return 'El telefono debe tener solo numeros despues del codigo del pais.';
  if (digits.length < 8 || digits.length > 15) {
    return 'Ese telefono no parece valido. Revisa el numero completo.';
  }
  return null;
}

/** Non-empty after trimming, with a field name for the message. */
export function validateRequired(value: string, label: string): string | null {
  return (value ?? '').trim() ? null : `${label} es requerido.`;
}

/**
 * Run several checks and return the first failure, so a form shows one clear
 * message rather than a wall of them.
 */
export function firstError(...results: (string | null)[]): string | null {
  return results.find((r) => r !== null) ?? null;
}
