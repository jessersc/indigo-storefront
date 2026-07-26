/**
 * PaymentRouter: Handles order number generation, WhatsApp order links,
 * and order persistence to Cloudflare D1 via the shared Worker (POST /orders).
 */

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  priceUsd: number;
  priceBs: number;
  variantId?: string;
}

export interface Order {
  orderNumber: string;
  items: OrderItem[];
  totalUsd: number;
  totalBs: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  customerCedula: string;
  customerEmail?: string;
  deliveryMethod: string;
  transactionId?: string;
  discountCode?: string;
  /** Free-text street address for home delivery. */
  customerAddress?: string;
  /** "Dejar con el conserje", reference points, etc. */
  deliveryInstructions?: string;
  /** Picked courier office, for national shipping. */
  courierName?: string;
  courierState?: string;
  courierOffice?: string;
}

const WHATSAPP_NUMBER = '584128503608';

// ─────────────────────────────────────────────
// Order Number Generation
// ─────────────────────────────────────────────

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/**
 * The store's order-number format: `XXX-RRSSRRHH`.
 *
 *   XXX  3 letters drawn at random from the current month's English name
 *        (repeats allowed, so NOVEMBER can yield "NEE")
 *   RR   random 00-99
 *   SS   current seconds
 *   RR   random 00-99
 *   HH   current hour, 24h
 *
 * e.g. November at 14:35:42 -> "NVE-52423514".
 * This is the format the store has always used and what customers quote in
 * support; it is a port of generateOrderNumber() in the legacy checkout.js.
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const monthLetters = MONTH_NAMES[now.getMonth()].split('');

  let xxx = '';
  for (let i = 0; i < 3; i++) {
    xxx += monthLetters[Math.floor(Math.random() * monthLetters.length)];
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const rr1 = pad(Math.floor(Math.random() * 100));
  const ss = pad(now.getSeconds());
  const rr2 = pad(Math.floor(Math.random() * 100));
  const hh = pad(now.getHours());

  return `${xxx}-${rr1}${ss}${rr2}${hh}`;
}

// ─────────────────────────────────────────────
// WhatsApp Deep Link Builder
// ─────────────────────────────────────────────

export function generateWhatsAppLink(order: Order): string {
  const itemsText = order.items
    .map(
      (item) =>
        `🔸 ${item.name}${item.variantId ? ` (${item.variantId})` : ''} (x${item.quantity})\n   💵 $${(item.priceUsd * item.quantity).toFixed(2)} / Bs ${(item.priceBs * item.quantity).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    )
    .join('\n\n');

  const deliveryLabel: Record<string, string> = {
    'pickup-store': 'Retirar en tienda 🏪',
    'delivery-home': 'Entrega a domicilio 🚚',
    'delivery-national': 'Envío nacional 📦',
  };

  const message = `🛒 *NUEVA ORDEN - ${order.orderNumber}*

📦 *Productos:*
${itemsText}

━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL:* $${order.totalUsd.toFixed(2)} / Bs ${order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}

💳 *Método de pago:* ${order.paymentMethod}
📬 *Entrega:* ${deliveryLabel[order.deliveryMethod] ?? order.deliveryMethod}

👤 *Datos del cliente:*
• Nombre: ${order.customerName}
• Teléfono: ${order.customerPhone}
• Cédula: ${order.customerCedula}${order.customerEmail ? `\n• Email: ${order.customerEmail}` : ''}

━━━━━━━━━━━━━━━━━━━━
¡Gracias por tu compra! 😊🎉
*Indigo Store* 🌟`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// ─────────────────────────────────────────────
// D1 Order Persistence (via the shared Worker)
// ─────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';

export interface SaveOrderOptions {
  // When logged in, links the order to the account.
  token?: string | null;
}

/** An item this order pushed to low/no stock, per the Worker. */
export interface StockWarning {
  productId: string;
  name: string | null;
  remaining: number;
  soldOut: boolean;
  held: boolean;
}

/**
 * A line the Worker refused because there is not enough stock. Carries the
 * numbers so the customer can be told exactly what to change instead of
 * guessing which item is the problem.
 */
export interface StockShortfall {
  productId: string;
  name: string | null;
  requested: number;
  available: number;
}

export interface SaveOrderResult {
  success: boolean;
  orderId?: string;
  status?: string;
  error?: string;
  /** Customer-facing message for the reason the save failed, when there is one. */
  message?: string;
  /** Set when the save failed on stock: which lines, and what is left. */
  shortfalls?: StockShortfall[];
  /** True while the store is open (Mon-Sat 8-18 Caracas). */
  businessHours?: boolean;
  contactMessage?: string;
  stockWarnings?: StockWarning[];
}

/**
 * Persist the order. It is always created `pending`: the Worker decides when an
 * order becomes paid, based on a gateway confirming server-to-server, and
 * ignores anything the browser claims about payment status.
 */
export async function saveOrderToD1(
  order: Order,
  opts: SaveOrderOptions = {},
): Promise<SaveOrderResult> {
  try {
    const payload = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerCedula: order.customerCedula,
      customerEmail: order.customerEmail,
      deliveryMethod: order.deliveryMethod,
      paymentMethod: order.paymentMethod,
      totalUsd: order.totalUsd,
      totalBs: order.totalBs,
      transactionId: order.transactionId,
      discountCode: order.discountCode,
      // Shipping destination: a street address for home delivery, or the
      // picked courier office for national shipping.
      customerAddress: order.customerAddress,
      deliveryInstructions: order.deliveryInstructions,
      courierName: order.courierName,
      courierState: order.courierState,
      courierOffice: order.courierOffice,
      items: order.items.map((item) => ({
        productId: item.id,
        variantId: item.variantId,
        name: item.name,
        quantity: item.quantity,
        priceUsd: item.priceUsd,
        priceBs: item.priceBs,
      })),
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;

    if (response.ok && data.ok) {
      return {
        success: true,
        orderId: data.orderId,
        status: data.status,
        businessHours: data.businessHours,
        contactMessage: data.contactMessage,
        stockWarnings: data.stockWarnings ?? [],
      };
    }
    console.error('saveOrderToD1 failed:', data.error ?? response.status);
    // The Worker rejects sold-out carts and tampered prices with a message
    // meant for the customer; pass it through rather than a generic failure.
    // `items` on an insufficient_stock rejection names the offending lines.
    return {
      success: false,
      error: data.error,
      message: data.message,
      shortfalls: data.error === 'insufficient_stock' ? (data.items ?? []) : undefined,
    };
  } catch (err: any) {
    console.error('saveOrderToD1 error:', err);
    return { success: false, error: err.message };
  }
}
