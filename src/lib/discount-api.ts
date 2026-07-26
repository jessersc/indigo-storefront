/** Storefront discount-code validation against the Worker. */

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

export interface DiscountResult {
  valid: boolean;
  code?: string;
  kind?: 'percent' | 'fixed';
  value?: number;
  amountUsd?: number;
  reason?: string;
  minSubtotalUsd?: number;
}

export async function validateDiscount(code: string, subtotalUsd: number): Promise<DiscountResult> {
  try {
    const res = await fetch(`${API_URL}/discounts/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotalUsd }),
    });
    return (await res.json()) as DiscountResult;
  } catch {
    return { valid: false, reason: 'network' };
  }
}

export function discountReasonEs(reason?: string, minSubtotalUsd?: number): string {
  switch (reason) {
    case 'not_found': return 'Codigo no valido.';
    case 'expired': return 'Este codigo ya expiro.';
    case 'not_active_yet': return 'Este codigo aun no esta activo.';
    case 'limit_reached': return 'Este codigo alcanzo su limite de usos.';
    case 'min_subtotal': return `Requiere una compra minima de $${minSubtotalUsd?.toFixed(2)}.`;
    default: return 'No se pudo aplicar el codigo.';
  }
}
