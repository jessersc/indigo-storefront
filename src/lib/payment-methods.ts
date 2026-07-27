/**
 * Payment methods: one definition, used by checkout and the product page.
 *
 * There used to be two hardcoded lists — one in CheckoutFlow, one in
 * ProductDetail with the same icons rewritten as JSX — and neither consulted
 * the dashboard. Three settings that looked editable did nothing at all:
 *
 *   `methods_enabled`   was never read, so every method always showed, whether
 *                       or not the store could actually accept it.
 *   `pay_zelle_email`   and `pay_binance_id` were never read either; the
 *                       account details on the checkout screen were literal
 *                       strings in the component, so editing them in the
 *                       dashboard changed nothing a customer could see.
 *   payment icons       could not be changed at all.
 *
 * Everything now resolves from `store_config` plus the `assets` table, with the
 * built-in definitions below as the fallback when nothing is configured.
 */

export type PaymentMethodId =
  | 'efectivo'
  | 'pago-movil'
  | 'cashea'
  | 'debito'
  | 'credito'
  | 'paypal'
  | 'zelle'
  | 'binance'
  | 'zinli'
  | 'us-transfer'
  | 'crypto';

/** How the method is settled — decides which UI the checkout shows. */
export type PaymentKind = 'manual' | 'mercantil' | 'gateway' | 'crypto';

export interface PaymentMethodDef {
  id: PaymentMethodId;
  title: string;
  kind: PaymentKind;
  /** Inline SVG. Overridden by a `payment_icon_<id>` asset when one exists. */
  svg: string;
}

/**
 * Built-in definitions, in the order they are offered.
 *
 * `us-transfer` is new: an international USD wire to a US account, for
 * customers paying from outside Venezuela.
 */
export const PAYMENT_METHOD_DEFS: PaymentMethodDef[] = [
  {
    id: 'efectivo', title: 'Efectivo', kind: 'manual',
    svg: `<svg viewBox='0 0 32 32' width='18' height='18' fill='none'><rect x='2' y='8' width='28' height='10' rx='2' fill='#82DCC7'/><rect x='2' y='18' width='28' height='6' rx='2' fill='#74CBB4'/><ellipse cx='16' cy='13' rx='4' ry='5' fill='#74CBB4'/><rect x='2' y='8' width='28' height='16' rx='2' stroke='#3b65d8' stroke-width='1.5'/></svg>`,
  },
  {
    id: 'pago-movil', title: 'Pago Móvil', kind: 'mercantil',
    svg: `<svg viewBox='0 0 32 32' width='18' height='18' fill='none'><rect x='3' y='6' width='8' height='18' rx='2' fill='#69d3cc' stroke='#3b65d8' stroke-width='1.5'/><rect x='6' y='8' width='4' height='1' rx='0.5' fill='#3b65d8'/><circle cx='8' cy='23' r='1' fill='#3b65d8'/><rect x='21' y='6' width='8' height='18' rx='2' fill='#f9a8a8' stroke='#3b65d8' stroke-width='1.5'/><rect x='24' y='8' width='4' height='1' rx='0.5' fill='#3b65d8'/><circle cx='26' cy='23' r='1' fill='#3b65d8'/></svg>`,
  },
  {
    id: 'cashea', title: 'Cashea', kind: 'gateway',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="18" height="18"><rect x="30" y="30" width="940" height="940" rx="220" ry="220" fill="#FFF212"/><circle cx="500" cy="520" r="320" fill="#373435"/><circle cx="500" cy="520" r="170" fill="#FFF212"/><rect x="665" y="420" width="300" height="200" fill="#FFF212"/><rect x="470" y="112" width="60" height="220" fill="#FFF212"/><rect x="640" y="440" width="40" height="40" fill="#FFF212"/></svg>`,
  },
  {
    id: 'debito', title: 'Débito', kind: 'mercantil',
    svg: `<svg width="18" height="18" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M894.5 249.6H330.8a37.7 37.7 0 0 0-37.5 37.8v342.4a37.7 37.7 0 0 0 37.5 37.8h563.8a37.7 37.7 0 0 0 37.6-37.8V287.4a37.7 37.7 0 0 0-37.6-37.8z" fill="#CCCCCC"/><path d="M293.2 333.6H932.1v97.7H293.2z" fill="#4D4D4D"/><path d="M688.7 388.3H124.9a37.7 37.7 0 0 0-37.5 37.8v342.4a37.7 37.7 0 0 0 37.5 37.8h563.8a37.7 37.7 0 0 0 37.5-37.8V426a37.7 37.7 0 0 0-37.5-37.8z" fill="#FFCA6C"/><path d="M87.4 472.3H726.3v97.7H87.4z" fill="#4D4D4D"/></svg>`,
  },
  {
    id: 'credito', title: 'Crédito', kind: 'mercantil',
    svg: `<svg width="18" height="18" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path style="fill:#B4E66E;" d="M418.5 367.2H25.1c-9.4 0-17.1-7.7-17.1-17.1V93.5c0-9.4 7.7-17.1 17.1-17.1h393.4c9.4 0 17.1 7.7 17.1 17.1v256.5c0 9.4-7.7 17.1-17.1 17.1z"/><path style="fill:#FFC850;" d="M136.3 204.7H67.9c-4.7 0-8.6-3.8-8.6-8.6V144.8c0-4.7 3.8-8.6 8.6-8.6h68.4c4.7 0 8.6 3.8 8.6 8.6v51.3c0 4.8-3.8 8.6-8.6 8.6z"/></svg>`,
  },
  {
    id: 'paypal', title: 'PayPal', kind: 'gateway',
    svg: `<svg viewBox='0 0 48 48' width='18' height='18'><path fill='#0d62ab' d='M18.7,13.767l0.005,0.002C18.809,13.326,19.187,13,19.66,13h13.472l-2.575,11.765H18.7L18.7,13.767z'></path><path fill='#199be2' d='M33.183,12.994c0.053,0.876-0.005,1.829-0.229,2.882c-1.281,5.995-5.912,9.115-11.635,9.115l-1.74,8.049z'></path></svg>`,
  },
  {
    id: 'zelle', title: 'Zelle', kind: 'manual',
    svg: `<svg viewBox='0 0 48 48' width='18' height='18'><path fill='#a0f' d='M35,42H13c-3.866,0-7-3.134-7-7V13c0-3.866,3.134-7,7-7h22c3.866,0,7,3.134,7,7v22 C42,38.866,38.866,42,35,42z'></path><path fill='#fff' d='M17.5,18.5h14v-4.5h-14V18.5z M17,34.5h14.5V30H17V34.5z'></path></svg>`,
  },
  {
    id: 'binance', title: 'Binance', kind: 'manual',
    svg: `<svg viewBox='0 0 64 64' width='18' height='18'><path fill='orange' d='M33.721,25.702l2.583,2.581c0.944,0.944,0.944,2.477,0,3.421l-2.587,2.587c-0.944,0.944-2.477,0.944-3.421,0l-2.583-2.583c-0.944-0.944-0.944-2.477,0-3.421l2.587-2.585C31.243,24.758,32.777,24.758,33.721,25.702z'/><path fill='orange' d='M19.298,23.295l-2.581-2.583c-0.944-0.943-0.944-2.479,0-3.421l13.58-13.584c0.944-0.945,2.477-0.945,3.421-0.001l13.583,13.576c0.943,0.944,0.944,2.477,0,3.421l-2.587,2.588c-0.944,0.943-2.477,0.943-3.421-0.001l-9.284-9.292l-9.288,9.297C21.777,24.239,20.243,24.241,19.298,23.295z'/><path fill='orange' d='M19.297,36.701l-2.583,2.583c-0.944,0.944-0.944,2.477,0,3.421l13.58,13.585c0.944,0.944,2.477,0.944,3.421,0l13.583-13.576c0.944-0.944,0.944-2.477,0-3.421l-2.587-2.587c-0.944-0.944-2.477-0.944-3.421,0l-9.284,9.292l-9.288-9.297C21.774,35.757,20.241,35.757,19.297,36.701z'/></svg>`,
  },
  {
    id: 'zinli', title: 'Zinli', kind: 'manual',
    svg: `<svg viewBox='0 0 52 22' width='18' height='18'><path d='M49.84 6.554v13.954h-3.318V6.553h3.317zM22.4 6.554v13.954h-3.315V6.553H22.4zM43.579.995v19.513h-3.32V.995h3.32zM18.595 2.166a2.164 2.164 0 112.161 2.162 2.179 2.179 0 01-2.161-2.162zM46.04 3.166a2.163 2.163 0 112.163 2.162 2.179 2.179 0 01-2.164-2.162zM33.988 6.562v7.16l-8.235-7.14a.342.342 0 00-.568.251V20.52h3.317v-7.175l8.238 7.162a.344.344 0 00.57-.251V6.562h-3.322zM6.489 20.513h9.64v-3.315H9.364l-2.875 3.315zM4.612 20.507L16.23 7.114a.344.344 0 00-.251-.57H2.22V9.86h7.36L.725 19.947a.344.344 0 00.251.57l3.635-.01z' fill='#22c55e'/></svg>`,
  },
  {
    id: 'us-transfer', title: 'Transferencia USA', kind: 'manual',
    svg: `<svg viewBox='0 0 32 32' width='18' height='18'><path d='M16 3 3 9v2h26V9L16 3z' fill='#3b65d8'/><rect x='6' y='13' width='3' height='10' fill='#5b83e8'/><rect x='12' y='13' width='3' height='10' fill='#5b83e8'/><rect x='18' y='13' width='3' height='10' fill='#5b83e8'/><rect x='24' y='13' width='2' height='10' fill='#5b83e8'/><rect x='3' y='25' width='26' height='3' rx='1' fill='#3b65d8'/></svg>`,
  },
  {
    id: 'crypto', title: 'USDT / USDC', kind: 'crypto',
    svg: `<svg viewBox='0 0 32 32' width='18' height='18'><circle cx='16' cy='16' r='14' fill='#2775CA'/><path d='M16 6a10 10 0 100 20 10 10 0 000-20zm1 15.2v1.3h-2v-1.3c-1.6-.2-2.7-1-2.9-2.4h1.6c.1.6.7 1 1.5 1.1v-2.4c-1.6-.3-2.9-.9-2.9-2.5 0-1.3 1.1-2.2 2.7-2.4V9.6h2v1.1c1.5.2 2.5 1 2.7 2.3h-1.6c-.1-.5-.5-.9-1.2-1v2.2c1.7.3 3 .9 3 2.6 0 1.4-1.1 2.3-2.9 2.5v.9zm-1-6v-2c-.7.1-1.1.5-1.1 1 0 .5.4.8 1.1 1zm1 2.1v2.2c.8-.1 1.2-.5 1.2-1.1 0-.5-.5-.9-1.2-1.1z' fill='#fff'/></svg>`,
  },
];

interface AssetLike {
  asset_type?: string | null;
  url?: string | null;
  html_content?: string | null;
}

export interface ResolvedPaymentMethod extends PaymentMethodDef {
  /** Set when the operator uploaded an image icon instead of inline SVG. */
  iconUrl?: string | null;
}

/**
 * The methods this store actually offers, in order, with dashboard overrides
 * applied.
 *
 * `methods_enabled` is a comma-separated list of ids. When it is missing or
 * empty every built-in method is offered, which is the behaviour that existed
 * before this was read at all — so turning the setting on is opt-in and cannot
 * silently empty the checkout.
 *
 * Icons: an asset with `asset_type = 'payment_icon_<id>'` replaces the built-in
 * artwork, using its `url` if it is an uploaded image or its `html_content` if
 * it is pasted SVG — the same two shapes the category and collection icons use.
 */
export function resolvePaymentMethods(
  config: Record<string, string> = {},
  assets: AssetLike[] = [],
): ResolvedPaymentMethod[] {
  const raw = (config.methods_enabled ?? '').trim();
  const enabled = raw
    ? new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
    : null;

  return PAYMENT_METHOD_DEFS.filter((m) => (enabled ? enabled.has(m.id) : true)).map((m) => {
    const icon = assets.find((a) => a.asset_type === `payment_icon_${m.id}`);
    return {
      ...m,
      svg: icon?.html_content?.trim() || m.svg,
      iconUrl: icon?.url || null,
    };
  });
}

// ─────────────────────────────────────────────
// Manual payment instructions
// ─────────────────────────────────────────────

export interface PaymentInstructionLine {
  label: string;
  value: string;
  /** Worth a tap-to-copy control: account numbers, emails, ids. */
  copyable?: boolean;
}

export interface ManualPaymentInstructions {
  intro: string;
  lines: PaymentInstructionLine[];
  note?: string;
  /** True when nothing is configured, so the UI can say so honestly. */
  unconfigured: boolean;
}

/**
 * Account details for a manual method, read from `store_config`.
 *
 * When a method is enabled but its details have not been filled in, this
 * returns `unconfigured: true` rather than an empty box or — as before — a
 * hardcoded address that may not be the store's. The checkout then tells the
 * customer to get in touch, which is recoverable; showing someone else's Zelle
 * address is not.
 */
export function manualPaymentInstructions(
  method: PaymentMethodId,
  config: Record<string, string> = {},
): ManualPaymentInstructions | null {
  const get = (key: string) => (config[key] ?? '').trim();

  switch (method) {
    case 'zelle': {
      const email = get('pay_zelle_email');
      const holder = get('pay_zelle_name');
      return {
        intro: 'Envia el pago a:',
        lines: [
          ...(email ? [{ label: 'Correo Zelle', value: email, copyable: true }] : []),
          ...(holder ? [{ label: 'Titular', value: holder }] : []),
        ],
        unconfigured: !email,
      };
    }

    case 'binance': {
      const id = get('pay_binance_id');
      return {
        intro: 'Envia el pago a nuestro ID de Binance:',
        lines: id ? [{ label: 'ID Binance', value: id, copyable: true }] : [],
        note: 'USDT / BNB Chain',
        unconfigured: !id,
      };
    }

    case 'zinli': {
      const email = get('pay_zinli_email');
      return {
        intro: 'Envia el pago a nuestra cuenta Zinli:',
        lines: email ? [{ label: 'Correo Zinli', value: email, copyable: true }] : [],
        unconfigured: !email,
      };
    }

    case 'us-transfer': {
      const bank = get('pay_usbank_bank');
      const beneficiary = get('pay_usbank_beneficiary');
      const routing = get('pay_usbank_routing');
      const account = get('pay_usbank_account');
      const type = get('pay_usbank_type');
      return {
        intro: 'Transferencia en dolares a nuestra cuenta en Estados Unidos:',
        lines: [
          ...(bank ? [{ label: 'Banco', value: bank }] : []),
          ...(beneficiary ? [{ label: 'Beneficiario', value: beneficiary }] : []),
          ...(routing ? [{ label: 'Routing (ABA)', value: routing, copyable: true }] : []),
          ...(account ? [{ label: 'Numero de cuenta', value: account, copyable: true }] : []),
          ...(type ? [{ label: 'Tipo de cuenta', value: type }] : []),
        ],
        note: 'Las transferencias internacionales pueden tardar de 1 a 3 dias habiles.',
        unconfigured: !account || !routing,
      };
    }

    case 'efectivo': {
      const address = get('pay_cash_address');
      return {
        intro: 'Paga en efectivo en nuestra tienda:',
        lines: address ? [{ label: 'Direccion', value: address }] : [],
        unconfigured: !address,
      };
    }

    default:
      return null;
  }
}
