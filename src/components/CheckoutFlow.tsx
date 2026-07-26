'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowUp, Check, CheckCircle, Clock, Copy, ExternalLink } from 'lucide-react';
import { useStorefront, type CartItem } from '../context/StorefrontContext';
import { useAuth } from '../context/AuthContext';
import { calculatePrices } from '../lib/currency';
import CryptoPayment from './CryptoPayment';
import CasheaPayment from './CasheaPayment';
import Turnstile, { turnstileEnabled } from './Turnstile';
import { validateCedula, validateEmail, validateVenezuelanMobile } from '../lib/validation';
import {
  generateOrderNumber,
  generateWhatsAppLink,
  saveOrderToD1,
  type Order,
  type OrderItem,
  type StockWarning,
  type StockShortfall,
} from '../lib/payments';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Step = 'form' | 'payment' | 'success' | 'pending';
type PaymentMethod =
  | 'efectivo'
  | 'pago-movil'
  | 'cashea'
  | 'debito'
  | 'credito'
  | 'paypal'
  | 'zelle'
  | 'binance'
  | 'zinli'
  | 'crypto';

interface FormData {
  deliveryMethod: 'pickup-store' | 'delivery-home' | 'delivery-national';
  name: string;
  phone: string;
  id: string;
  email: string;
  address: string;
  instructions: string;
  emailText: string;
  emailTextNational: string;
  courier: string;
  state: string;
  office: string;
  paymentMethod: PaymentMethod;
}

interface CourierOffice {
  id: string;
  name: string;
  state: string;
  office: string;
}

// Mercantil modal state
interface MercantilForm {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  otpCode: string;
  step: 'card' | 'otp';
}

interface CheckoutFlowProps {
  totalUsd: number;
  totalBs: number;
  discountCode?: string;
  onComplete: (data: FormData) => void;
  onBack: () => void;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MANUAL_METHODS: PaymentMethod[] = ['efectivo', 'zelle', 'binance', 'zinli'];
const MERCANTIL_METHODS: PaymentMethod[] = ['pago-movil', 'debito', 'credito'];

const PAYMENT_METHODS = [
  {
    id: 'efectivo' as PaymentMethod,
    title: 'Efectivo',
    svg: `<svg viewBox='0 0 32 32' width='18' height='18' fill='none'><rect x='2' y='8' width='28' height='10' rx='2' fill='#82DCC7'/><rect x='2' y='18' width='28' height='6' rx='2' fill='#74CBB4'/><ellipse cx='16' cy='13' rx='4' ry='5' fill='#74CBB4'/><rect x='2' y='8' width='28' height='16' rx='2' stroke='#3b65d8' stroke-width='1.5'/></svg>`,
  },
  {
    id: 'pago-movil' as PaymentMethod,
    title: 'Pago Móvil',
    svg: `<svg viewBox='0 0 32 32' width='18' height='18' fill='none'><rect x='3' y='6' width='8' height='18' rx='2' fill='#69d3cc' stroke='#3b65d8' stroke-width='1.5'/><rect x='6' y='8' width='4' height='1' rx='0.5' fill='#3b65d8'/><circle cx='8' cy='23' r='1' fill='#3b65d8'/><rect x='21' y='6' width='8' height='18' rx='2' fill='#f9a8a8' stroke='#3b65d8' stroke-width='1.5'/><rect x='24' y='8' width='4' height='1' rx='0.5' fill='#3b65d8'/><circle cx='26' cy='23' r='1' fill='#3b65d8'/></svg>`,
  },
  {
    id: 'cashea' as PaymentMethod,
    title: 'Cashea',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="18" height="18"><rect x="30" y="30" width="940" height="940" rx="220" ry="220" fill="#FFF212"/><circle cx="500" cy="520" r="320" fill="#373435"/><circle cx="500" cy="520" r="170" fill="#FFF212"/><rect x="665" y="420" width="300" height="200" fill="#FFF212"/><rect x="470" y="112" width="60" height="220" fill="#FFF212"/><rect x="640" y="440" width="40" height="40" fill="#FFF212"/></svg>`,
  },
  {
    id: 'debito' as PaymentMethod,
    title: 'Débito',
    svg: `<svg width="18" height="18" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M894.5 249.6H330.8a37.7 37.7 0 0 0-37.5 37.8v342.4a37.7 37.7 0 0 0 37.5 37.8h563.8a37.7 37.7 0 0 0 37.6-37.8V287.4a37.7 37.7 0 0 0-37.6-37.8z" fill="#CCCCCC"/><path d="M293.2 333.6H932.1v97.7H293.2z" fill="#4D4D4D"/><path d="M688.7 388.3H124.9a37.7 37.7 0 0 0-37.5 37.8v342.4a37.7 37.7 0 0 0 37.5 37.8h563.8a37.7 37.7 0 0 0 37.5-37.8V426a37.7 37.7 0 0 0-37.5-37.8z" fill="#FFCA6C"/><path d="M87.4 472.3H726.3v97.7H87.4z" fill="#4D4D4D"/></svg>`,
  },
  {
    id: 'credito' as PaymentMethod,
    title: 'Crédito',
    svg: `<svg width="18" height="18" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path style="fill:#B4E66E;" d="M418.5 367.2H25.1c-9.4 0-17.1-7.7-17.1-17.1V93.5c0-9.4 7.7-17.1 17.1-17.1h393.4c9.4 0 17.1 7.7 17.1 17.1v256.5c0 9.4-7.7 17.1-17.1 17.1z"/><path style="fill:#FFC850;" d="M136.3 204.7H67.9c-4.7 0-8.6-3.8-8.6-8.6V144.8c0-4.7 3.8-8.6 8.6-8.6h68.4c4.7 0 8.6 3.8 8.6 8.6v51.3c0 4.8-3.8 8.6-8.6 8.6z"/></svg>`,
  },
  {
    id: 'paypal' as PaymentMethod,
    title: 'PayPal',
    svg: `<svg viewBox='0 0 48 48' width='18' height='18'><path fill='#0d62ab' d='M18.7,13.767l0.005,0.002C18.809,13.326,19.187,13,19.66,13h13.472l-2.575,11.765H18.7L18.7,13.767z'></path><path fill='#199be2' d='M33.183,12.994c0.053,0.876-0.005,1.829-0.229,2.882c-1.281,5.995-5.912,9.115-11.635,9.115l-1.74,8.049z'></path></svg>`,
  },
  {
    id: 'zelle' as PaymentMethod,
    title: 'Zelle',
    svg: `<svg viewBox='0 0 48 48' width='18' height='18'><path fill='#a0f' d='M35,42H13c-3.866,0-7-3.134-7-7V13c0-3.866,3.134-7,7-7h22c3.866,0,7,3.134,7,7v22 C42,38.866,38.866,42,35,42z'></path><path fill='#fff' d='M17.5,18.5h14v-4.5h-14V18.5z M17,34.5h14.5V30H17V34.5z'></path></svg>`,
  },
  {
    id: 'binance' as PaymentMethod,
    title: 'Binance',
    svg: `<svg viewBox='0 0 64 64' width='18' height='18'><path fill='orange' d='M33.721,25.702l2.583,2.581c0.944,0.944,0.944,2.477,0,3.421l-2.587,2.587c-0.944,0.944-2.477,0.944-3.421,0l-2.583-2.583c-0.944-0.944-0.944-2.477,0-3.421l2.587-2.585C31.243,24.758,32.777,24.758,33.721,25.702z'/><path fill='orange' d='M19.298,23.295l-2.581-2.583c-0.944-0.943-0.944-2.479,0-3.421l13.58-13.584c0.944-0.945,2.477-0.945,3.421-0.001l13.583,13.576c0.943,0.944,0.944,2.477,0,3.421l-2.587,2.588c-0.944,0.943-2.477,0.943-3.421-0.001l-9.284-9.292l-9.288,9.297C21.777,24.239,20.243,24.241,19.298,23.295z'/><path fill='orange' d='M19.297,36.701l-2.583,2.583c-0.944,0.944-0.944,2.477,0,3.421l13.58,13.585c0.944,0.944,2.477,0.944,3.421,0l13.583-13.576c0.944-0.944,0.944-2.477,0-3.421l-2.587-2.587c-0.944-0.944-2.477-0.944-3.421,0l-9.284,9.292l-9.288-9.297C21.774,35.757,20.241,35.757,19.297,36.701z'/></svg>`,
  },
  {
    id: 'zinli' as PaymentMethod,
    title: 'Zinli',
    svg: `<svg viewBox='0 0 52 22' width='18' height='18'><path d='M49.84 6.554v13.954h-3.318V6.553h3.317zM22.4 6.554v13.954h-3.315V6.553H22.4zM43.579.995v19.513h-3.32V.995h3.32zM18.595 2.166a2.164 2.164 0 112.161 2.162 2.179 2.179 0 01-2.161-2.162zM46.04 3.166a2.163 2.163 0 112.163 2.162 2.179 2.179 0 01-2.164-2.162zM33.988 6.562v7.16l-8.235-7.14a.342.342 0 00-.568.251V20.52h3.317v-7.175l8.238 7.162a.344.344 0 00.57-.251V6.562h-3.322zM6.489 20.513h9.64v-3.315H9.364l-2.875 3.315zM4.612 20.507L16.23 7.114a.344.344 0 00-.251-.57H2.22V9.86h7.36L.725 19.947a.344.344 0 00.251.57l3.635-.01z' fill='#22c55e'/></svg>`,
  },
  {
    id: 'crypto' as PaymentMethod,
    title: 'USDT / USDC',
    svg: `<svg viewBox='0 0 32 32' width='18' height='18'><circle cx='16' cy='16' r='14' fill='#2775CA'/><path d='M16 6a10 10 0 100 20 10 10 0 000-20zm1 15.2v1.3h-2v-1.3c-1.6-.2-2.7-1-2.9-2.4h1.6c.1.6.7 1 1.5 1.1v-2.4c-1.6-.3-2.9-.9-2.9-2.5 0-1.3 1.1-2.2 2.7-2.4V9.6h2v1.1c1.5.2 2.5 1 2.7 2.3h-1.6c-.1-.5-.5-.9-1.2-1v2.2c1.7.3 3 .9 3 2.6 0 1.4-1.1 2.3-2.9 2.5v.9zm-1-6v-2c-.7.1-1.1.5-1.1 1 0 .5.4.8 1.1 1zm1 2.1v2.2c.8-.1 1.2-.5 1.2-1.1 0-.5-.5-.9-1.2-1.1z' fill='#fff'/></svg>`,
  },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function CheckoutFlow({ totalUsd, totalBs, discountCode, onComplete, onBack }: CheckoutFlowProps) {
  // `cartItems` here is the SELECTED subset: unticked lines are parked, not
  // bought, so they must not appear in the summary, the totals or the order.
  const {
    selectedCartItems: cartItems,
    rates,
    updateCartQuantity,
    removeCartItems,
    assets,
  } = useStorefront();
  const { user, token } = useAuth();

  // Dashboard-editable shipping messages (Settings -> assets). Falls back to
  // the historical copy so the checkout never shows a blank line if the
  // asset hasn't been set yet.
  const shippingChargesMessage =
    (assets || []).find((a: any) => a.asset_type === 'shipping_charges_message')?.html_content ||
    'Posibles cargos de envío: $4.00 - $10.00';
  const shippingPriceMessage = (assets || []).find((a: any) => a.asset_type === 'shipping_price_message')
    ?.html_content;

  // ── Step State ──
  const [step, setStep] = useState<Step>('form');
  const [orderNumber, setOrderNumber] = useState('');
  /**
   * Whether the order number may be SHOWN to the customer.
   *
   * The number is generated as soon as the contact form is submitted, because
   * the gateways need a reference to quote. But showing it that early hands out
   * a number for an order that does not exist yet: abandon the payment and the
   * customer is holding a reference support cannot find. It becomes visible only
   * once ensureOrderSaved has persisted the order.
   */
  const [orderRegistered, setOrderRegistered] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Which order number has already been persisted, so re-entering a payment
  // flow (or retrying after a decline) does not save the same order twice. A
  // ref, not state: ensureOrderSaved reads it in the same tick it writes it.
  const savedOrderRef = useRef<string | null>(null);
  // The PayPal SDK keeps the callbacks we hand it for the lifetime of the
  // rendered buttons, so calling ensureOrderSaved directly from there would use
  // whatever form state existed when the buttons mounted. This ref always
  // points at the current one.
  const ensureOrderSavedRef = useRef<(orderNum: string) => Promise<boolean>>(async () => false);
  // Server-reported stock scarcity + the contact line for the pending screen.
  const [stockWarnings, setStockWarnings] = useState<StockWarning[]>([]);
  const [contactMessage, setContactMessage] = useState('');
  // Lines this order was placed with, kept so the confirmation screens still
  // have something to show once the cart has been emptied.
  const [orderedItems, setOrderedItems] = useState<CartItem[]>([]);
  // Per-product shortfalls from the Worker, so the customer is told which item
  // ran out and how many are left rather than just "something is unavailable".
  const [stockShortfalls, setStockShortfalls] = useState<StockShortfall[]>([]);

  // ── Courier State ──
  const [courierList, setCourierList] = useState<CourierOffice[]>([]);
  const [isLoadingCouriers, setIsLoadingCouriers] = useState(false);

  // ── Form State ──
  const [formData, setFormData] = useState<FormData>({
    deliveryMethod: 'pickup-store',
    name: '',
    phone: '',
    id: '',
    email: '',
    address: '',
    instructions: '',
    emailText: '',
    emailTextNational: '',
    courier: '',
    state: '',
    office: '',
    paymentMethod: 'efectivo',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ── Payment Processing State ──
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  /**
   * Turnstile proof for creating the order. Held here rather than per payment
   * method because every method funnels through ensureOrderSaved, which is the
   * call that actually reserves stock. Empty string when the widget has not
   * solved yet or the token expired; the component re-challenges on its own.
   */
  const [turnstileToken, setTurnstileToken] = useState('');

  // ── PayPal State ──
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  // ── Mercantil Modal State ──
  const [mercantilForm, setMercantilForm] = useState<MercantilForm>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    otpCode: '',
    step: 'card',
  });

  // ── Copy button ──
  const [copied, setCopied] = useState(false);

  // ─────────────────────────────────────────────
  // Side Effects
  // ─────────────────────────────────────────────

  // Fetch couriers from the shared Worker (D1). Replaces the previous direct
  // Supabase call with a hardcoded anon key.
  useEffect(() => {
    async function fetchCouriers() {
      setIsLoadingCouriers(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_INDIGO_API_URL || 'http://localhost:8787';
        const response = await fetch(`${apiUrl}/couriers`);
        if (response.ok) {
          const payload = await response.json() as { couriers?: CourierOffice[] };
          const data = payload.couriers ?? [];
          data.sort((a: any, b: any) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            if (nameA !== nameB) return nameA.localeCompare(nameB);
            const stateA = (a.state || '').toLowerCase();
            const stateB = (b.state || '').toLowerCase();
            if (stateA !== stateB) return stateA.localeCompare(stateB);
            return (a.office || '').toLowerCase().localeCompare((b.office || '').toLowerCase());
          });
          setCourierList(data);
        }
      } catch (error) {
        console.error('Error fetching couriers:', error);
      } finally {
        setIsLoadingCouriers(false);
      }
    }
    fetchCouriers();
  }, []);

  // Prefill from the signed-in account (only empty fields, so edits are kept).
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone || '',
      id: prev.id || user.cedula || '',
    }));
  }, [user]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 200);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load PayPal SDK when on payment step with paypal selected
  useEffect(() => {
    if (step !== 'payment' || formData.paymentMethod !== 'paypal') return;

    let cancelled = false;

    async function loadPayPal() {
      try {
        // Get client ID from our Vercel API
        const configRes = await fetch('/api/paypal/config');
        const config = await configRes.json() as any;
        const clientId = config.clientId;

        if (!clientId) {
          setPaymentError('PayPal no está configurado. Elige otro método de pago.');
          return;
        }

        // Remove any existing PayPal script
        const existingScript = document.getElementById('paypal-sdk');
        if (existingScript) existingScript.remove();
        (window as any).paypal = undefined;

        // Load PayPal SDK
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.id = 'paypal-sdk';
          script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
          document.head.appendChild(script);
        });

        if (cancelled) return;

        // Wait for container ref to mount
        await new Promise((r) => setTimeout(r, 200));

        if (!paypalContainerRef.current || cancelled) return;

        paypalContainerRef.current.innerHTML = '';

        const paypal = (window as any).paypal;
        if (!paypal) {
          setPaymentError('Error cargando PayPal. Intenta de nuevo.');
          return;
        }

        paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'pill',
            label: 'pay',
          },
          createOrder: async () => {
            // Our order must exist before PayPal's does: /api/paypal/capture
            // confirms it server-to-server by order number once the capture
            // completes.
            if (!(await ensureOrderSavedRef.current(orderNumber))) {
              throw new Error('No pudimos registrar tu pedido.');
            }
            const res = await fetch('/api/paypal/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: totalUsd.toFixed(2) }),
            });
            const data = await res.json() as any;
            if (!data.id) throw new Error('Failed to create PayPal order');
            return data.id;
          },
          onApprove: async (data: any) => {
            setIsProcessing(true);
            setPaymentError('');
            try {
              const captureRes = await fetch('/api/paypal/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID, orderNumber }),
              });
              const captureData = await captureRes.json() as any;

              if (captureData.status === 'COMPLETED' || captureData.id) {
                await handlePaymentSuccess('paypal', captureData.id ?? data.orderID);
              } else {
                setPaymentError('El pago no pudo ser procesado. Intenta de nuevo.');
              }
            } catch (err) {
              setPaymentError('Error procesando el pago. Intenta de nuevo.');
            } finally {
              setIsProcessing(false);
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            setPaymentError('Error en PayPal. Por favor intenta de nuevo.');
          },
          onCancel: () => {
            setPaymentError('Pago cancelado.');
          },
        }).render(paypalContainerRef.current);

        if (!cancelled) setPaypalLoaded(true);
      } catch (err: any) {
        if (!cancelled) setPaymentError(err.message ?? 'Error cargando PayPal.');
      }
    }

    loadPayPal();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formData.paymentMethod]);

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const buildOrderItems = (): OrderItem[] =>
    cartItems.map((item) => {
      const prices = calculatePrices(item.base_price_usd || item.USD || 0, rates);
      return {
        id: item.ItemID || item.id || '',
        name: item.name || item.Product || '',
        quantity: item.quantity,
        priceUsd: prices.usd,
        priceBs: prices.bs,
        variantId: typeof item.variant === 'string'
          ? item.variant
          : (item.variant as any)?.variant_name ?? undefined,
      };
    });

  const buildOrder = (orderNum: string, transId?: string): Order => {
    const isNational = formData.deliveryMethod === 'delivery-national';
    const isHome = formData.deliveryMethod === 'delivery-home';

    // Each delivery method has its own free-text field(s): home delivery asks
    // for directions plus an optional note, national shipping has one note.
    // They all land in the order's single delivery_instructions column.
    const notes = (isNational
      ? [formData.emailTextNational]
      : [formData.instructions, formData.emailText]
    )
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n');

    return {
      orderNumber: orderNum,
      items: buildOrderItems(),
      totalUsd,
      totalBs,
      paymentMethod: formData.paymentMethod,
      customerName: formData.name,
      customerPhone: formData.phone,
      customerCedula: formData.id,
      customerEmail: formData.email || undefined,
      deliveryMethod: formData.deliveryMethod,
      transactionId: transId,
      discountCode: discountCode || undefined,
      // Home delivery has a street address; national shipping has a courier
      // office instead, which is also flattened into the address line so the
      // destination reads correctly wherever only one field is shown.
      customerAddress: isHome
        ? formData.address.trim() || undefined
        : isNational
          ? [formData.office, formData.state, formData.courier].filter(Boolean).join(', ') || undefined
          : undefined,
      deliveryInstructions: notes || undefined,
      courierName: isNational ? formData.courier || undefined : undefined,
      courierState: isNational ? formData.state || undefined : undefined,
      courierOffice: isNational ? formData.office || undefined : undefined,
    };
  };

  /**
   * Persist the order as `pending` BEFORE handing off to a payment gateway.
   *
   * The gateway's own Vercel route confirms it server-to-server once the
   * provider says the money moved, so the order has to exist first. This also
   * gives the Worker its chance to reject a sold-out or mis-priced cart while
   * the customer can still do something about it — unlike the old flow, which
   * saved after payment and would have taken the money regardless.
   *
   * Returns false when the order could not be saved; the caller must not start
   * a payment in that case.
   */
  const ensureOrderSaved = async (orderNum: string): Promise<boolean> => {
    if (savedOrderRef.current === orderNum) return true;

    // Only enforced when Turnstile is actually configured; otherwise the widget
    // renders nothing and the Worker skips the check, so requiring a token here
    // would deadlock local development.
    if (turnstileEnabled() && !turnstileToken) {
      setPaymentError(
        'Estamos verificando que eres una persona. Espera un momento e intenta de nuevo.',
      );
      return false;
    }

    const order = buildOrder(orderNum);
    const result = await saveOrderToD1(order, { token, turnstileToken });
    if (!result.success) {
      setStockShortfalls(result.shortfalls ?? []);
      setPaymentError(
        result.message ?? 'No pudimos registrar tu pedido. Recarga la pagina e intenta de nuevo.',
      );
      return false;
    }

    setStockShortfalls([]);
    savedOrderRef.current = orderNum;
    // The number is now a real order in the database, so it is finally safe to
    // put in front of the customer. See orderRegistered.
    setOrderRegistered(true);
    setStockWarnings(result.stockWarnings ?? []);
    setContactMessage(result.contactMessage ?? '');
    return true;
  };

  // Keep the PayPal-facing reference pointing at the current closure.
  ensureOrderSavedRef.current = ensureOrderSaved;

  /**
   * The gateway reported success. The order was already saved as pending and
   * the Vercel route has already confirmed it with the Worker over the internal
   * channel, so there is nothing to persist here — just show the customer.
   */
  /**
   * Trim the cart to what the Worker says is actually available: drop the
   * sold-out lines, reduce the rest. Saves the customer hunting through the
   * cart for the line that blocked checkout.
   */
  const applyStockShortfalls = () => {
    for (const s of stockShortfalls) {
      // Cart ids are `<productId>` or `<productId>-<variant>`, so match on the
      // product id the Worker reported rather than assuming a bare id.
      const lines = cartItems.filter(
        (item) => String(item.ItemID) === String(s.productId),
      );
      for (const line of lines) {
        updateCartQuantity(String(line.id), s.available);
      }
    }
    setStockShortfalls([]);
    setPaymentError('');
    savedOrderRef.current = null;
    setStep('form');
    scrollToTop();
  };

  /**
   * Snapshot the lines, then empty the cart. Always use this rather than
   * clearCart() directly: the confirmation screens render after the cart is
   * gone, and without the snapshot they show an empty order and a $0.00 total.
   */
  const finalizeCart = () => {
    setOrderedItems(cartItems);
    // Remove only the lines that were actually ordered. Clearing everything
    // would silently throw away whatever the customer deliberately deselected
    // to buy later.
    removeCartItems(cartItems.map((item) => String(item.id)));
  };

  const handlePaymentSuccess = async (method: string, transactionId?: string) => {
    const orderNum = orderNumber || generateOrderNumber();
    if (!orderNumber) setOrderNumber(orderNum);

    setCompletedOrder(buildOrder(orderNum, transactionId));
    finalizeCart();
    setStep('success');
  };

  // ─────────────────────────────────────────────
  // Courier dropdowns
  // ─────────────────────────────────────────────

  const prioritized = ['MRW', 'Zoom', 'Tealca'];
  const uniqueCouriers = Array.from(new Set(courierList.map((c) => c.name))).sort((a, b) => {
    const aPri = prioritized.indexOf(a);
    const bPri = prioritized.indexOf(b);
    if (aPri !== -1 && bPri !== -1) return aPri - bPri;
    if (aPri !== -1) return -1;
    if (bPri !== -1) return 1;
    return a.localeCompare(b);
  });

  const statesForCourier = formData.courier
    ? Array.from(new Set(courierList.filter((c) => c.name === formData.courier).map((c) => c.state))).sort()
    : [];

  const officesForStateAndCourier =
    formData.courier && formData.state
      ? courierList.filter((c) => c.name === formData.courier && c.state === formData.state)
      : [];

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  /**
   * Returns a specific Spanish message, or null when the form is fine.
   *
   * Replaces a boolean + one generic "completa todos los campos" alert, which
   * gave no clue which field was wrong. Cedula is now length-checked (it only
   * had to be digits, so "1" passed), and Pago Movil additionally requires a
   * real Venezuelan mobile, because C2P debits that line -- a number that
   * cannot receive the debit is a guaranteed decline, and there is no reason to
   * spend a bank call discovering that.
   */
  const formValidationError = (): string | null => {
    if (!formData.name.trim()) return 'Escribe tu nombre completo.';

    const cedulaError = validateCedula(formData.id);
    if (cedulaError) return cedulaError;

    const emailError = validateEmail(formData.email);
    if (emailError) return emailError;

    if (formData.deliveryMethod !== 'pickup-store' && !formData.phone.trim()) {
      return 'El telefono es requerido para el envio.';
    }
    if (formData.deliveryMethod === 'delivery-home' && !formData.address.trim()) {
      return 'Escribe la direccion de entrega.';
    }
    if (formData.deliveryMethod === 'delivery-national') {
      if (!formData.courier) return 'Elige el courier.';
      if (!formData.state) return 'Elige el estado.';
      if (!formData.office) return 'Elige la oficina.';
    }

    if (!formData.paymentMethod) return 'Elige un metodo de pago.';

    if (formData.paymentMethod === 'pago-movil') {
      const mobileError = validateVenezuelanMobile(formData.phone);
      if (mobileError) return `Pago Movil: ${mobileError}`;
    }

    return null;
  };

  const validateForm = () => formValidationError() === null;

  const isFieldInvalid = (fieldName: string) => {
    if (!isSubmitted) return false;
    if (fieldName === 'name') return !formData.name.trim();
    if (fieldName === 'id') return !formData.id.trim() || !/^\d+$/.test(formData.id.trim());
    if (fieldName === 'email') return !formData.email.trim() || !EMAIL_RE.test(formData.email.trim());
    if (fieldName === 'phone')
      return formData.deliveryMethod !== 'pickup-store' && !formData.phone.trim();
    if (fieldName === 'address')
      return formData.deliveryMethod === 'delivery-home' && !formData.address.trim();
    if (fieldName === 'courier')
      return formData.deliveryMethod === 'delivery-national' && !formData.courier;
    if (fieldName === 'state')
      return formData.deliveryMethod === 'delivery-national' && !formData.state;
    if (fieldName === 'office')
      return formData.deliveryMethod === 'delivery-national' && !formData.office;
    return false;
  };

  const getInputClass = (fieldName: string) => {
    const isInvalid = isFieldInvalid(fieldName);
    return `w-full p-4 bg-white border rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm ${
      isInvalid
        ? 'border-red-400 focus:border-red-500 bg-red-50/50'
        : 'border-slate-200 focus:border-kawaii-pink'
    }`;
  };

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, id: e.target.value.replace(/[^0-9]/g, '') }));
  };

  // ─────────────────────────────────────────────
  // Form Submit → go to payment step
  // ─────────────────────────────────────────────

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    const validationError = formValidationError();
    if (validationError) {
      alert(validationError);
      return;
    }
    const num = generateOrderNumber();
    setOrderNumber(num);
    // A fresh number is not a saved order. Without this reset, going back and
    // resubmitting the form would display the NEW number immediately, because
    // the flag was still true from the previous attempt.
    setOrderRegistered(false);
    setPaymentError('');
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─────────────────────────────────────────────
  // Manual payment (Efectivo/Zelle/Binance/Zinli)
  // ─────────────────────────────────────────────

  const handleManualPayment = async () => {
    setIsProcessing(true);
    setPaymentError('');
    try {
      // Manual methods (efectivo/zelle/binance/zinli) have no gateway to verify
      // them: the order sits pending until an admin confirms the payment by
      // hand. Saving first also lets the Worker reject a sold-out cart before
      // the customer is sent off to WhatsApp.
      if (!(await ensureOrderSaved(orderNumber))) return;

      const order = buildOrder(orderNumber);
      setCompletedOrder(order);
      // The items belong to the order now, not the cart.
      finalizeCart();
      window.open(generateWhatsAppLink(order), '_blank');
      setStep('pending');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────
  // Mercantil payment
  // ─────────────────────────────────────────────

  const handleMercantilSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setPaymentError('');

    try {
      // Save first: /api/mercantil confirms the order server-to-server by
      // order number the moment the bank approves, so it must already exist.
      if (!(await ensureOrderSaved(orderNumber))) return;

      const isPagoMovil = formData.paymentMethod === 'pago-movil';

      const payload: Record<string, string> = {
        paymentMethod: formData.paymentMethod,
        amount: totalBs.toFixed(2), // Mercantil charges in Bs
        customerCedula: formData.id,
        customerName: formData.name,
        customerPhone: formData.phone,
        orderNumber,
      };

      if (isPagoMovil) {
        payload.otpCode = mercantilForm.otpCode;
      } else {
        payload.cardNumber = mercantilForm.cardNumber.replace(/\s/g, '');
        payload.expiryDate = mercantilForm.expiryDate;
        payload.cvv = mercantilForm.cvv;
        if (formData.paymentMethod === 'debito') {
          payload.otpCode = mercantilForm.otpCode;
        }
      }

      const res = await fetch('/api/mercantil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as any;

      if (data.success) {
        await handlePaymentSuccess(formData.paymentMethod, data.transactionId);
      } else {
        // `error` before `message`: the route puts the bank's specific reason
        // (or the field that failed validation) in `error` and a generic "Pago
        // rechazado" in `message`, so preferring `message` told the customer
        // nothing they could act on.
        setPaymentError(data.error || data.message || 'Pago rechazado por el banco.');
      }
    } catch (err: any) {
      setPaymentError('Error procesando el pago. Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────
  // Copy order number
  // ─────────────────────────────────────────────

  const copyOrderNumber = () => {
    if (!orderNumber) return;
    navigator.clipboard.writeText(orderNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─────────────────────────────────────────────
  // Shared: Order Summary Card
  // ─────────────────────────────────────────────

  /**
   * The confirmation screens render AFTER clearCart(), so reading live cart
   * state there showed an empty list and a $0.00 total (the totals are props
   * the parent recomputes from the cart). `orderedItems` is the snapshot taken
   * at order time, and `completedOrder` carries the real totals.
   */
  const summaryItems = orderedItems.length > 0 ? orderedItems : cartItems;
  const summaryTotalUsd = completedOrder ? completedOrder.totalUsd : totalUsd;
  const summaryTotalBs = completedOrder ? completedOrder.totalBs : totalBs;

  const OrderSummaryCard = () => (
    <div className="bg-[#fff6fa] rounded-3xl border border-[#ffe0ef] p-4 space-y-3">
      <h4 className="font-black text-slate-700 text-sm tracking-wide">📋 Resumen de tu pedido</h4>
      <div className="space-y-2">
        {summaryItems.map((item) => {
          const prices = calculatePrices(item.base_price_usd || item.USD || 0, rates);
          const displayImage = item.image || item.Image;
          return (
            <div key={item.id} className="flex gap-3 items-center">
              {displayImage && (
                <img
                  src={displayImage}
                  className="w-10 h-10 rounded-xl object-cover border border-[#ffe0ef] bg-white flex-shrink-0"
                  alt={item.name}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 truncate">
                  {item.name || item.Product}
                </p>
                {item.variant && (
                  <p className="text-[10px] text-kawaii-pink font-bold">
                    {typeof item.variant === 'string' ? item.variant : (item.variant as any)?.variant_name}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-bold">x{item.quantity}</p>
              </div>
              <div className="text-right text-[10px] font-bold text-slate-500">
                ${(prices.usd * item.quantity).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="pt-2 border-t border-[#ffe0ef] flex justify-between items-center">
        <span className="font-black text-kawaii-pink text-sm">TOTAL</span>
        <div className="text-right">
          <div className="font-black text-kawaii-pink text-sm">${summaryTotalUsd.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-bold">
            Bs {summaryTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // RENDER: Success Screen
  // ─────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-[0_8px_24px_rgba(16,185,129,0.35)]">
            <CheckCircle size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">¡Pago Confirmado!</h1>
          <p className="text-slate-500 font-bold">Tu pedido ha sido procesado exitosamente ✨</p>
        </div>

        {orderRegistered && orderNumber && (
          <div className="bg-[#fff6fa] rounded-3xl border border-[#ffe0ef] p-6 space-y-2">
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Número de orden</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-bubble text-2xl text-kawaii-pink tracking-wider">{orderNumber}</span>
              <button
                onClick={copyOrderNumber}
                className="p-2 rounded-xl bg-white border border-[#ffe0ef] hover:bg-[#ffe0ef] transition-colors cursor-pointer"
                title="Copiar número de orden"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-400" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 font-semibold">Guarda este número como referencia</p>
          </div>
        )}

        {completedOrder && (
          <div className="text-left">
            <OrderSummaryCard />
          </div>
        )}

        <button
          onClick={() => onComplete(formData)}
          className="w-full bg-kawaii-pink text-white py-4 rounded-full font-black text-lg tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_20px_rgba(255,107,157,0.3)]"
        >
          VOLVER A LA TIENDA
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Pending Screen (Manual payments)
  // ─────────────────────────────────────────────

  if (step === 'pending') {
    const order = completedOrder;
    const waLink = order ? generateWhatsAppLink(order) : '#';

    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-[0_8px_24px_rgba(251,191,36,0.35)]">
            <Clock size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">¡Pedido Registrado!</h1>
          <p className="text-slate-500 font-bold text-sm leading-relaxed max-w-xs">
            {contactMessage || 'Para completar tu compra, envíanos el comprobante de pago por WhatsApp'}
          </p>
        </div>

        {/* Items this order pushed to low/no stock. The Worker reserves them
            for 2 hours; after that the stock is free again, though the order
            itself stays pending until the payment is confirmed. */}
        {stockWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-left space-y-2">
            <p className="font-black text-amber-800 text-sm">⏳ Confirma pronto tu pago</p>
            <ul className="space-y-1">
              {stockWarnings.map((w) => (
                <li key={w.productId} className="text-xs font-semibold text-amber-700">
                  {w.soldOut
                    ? `“${w.name ?? 'Un producto'}” es la última unidad disponible.`
                    : `Quedan ${w.remaining} unidades de “${w.name ?? 'un producto'}”.`}
                </li>
              ))}
            </ul>
            <p className="text-xs font-semibold text-amber-600">
              Te lo reservamos por 2 horas. Si no confirmamos tu pago en ese tiempo, podría
              agotarse — tu pedido seguirá registrado.
            </p>
          </div>
        )}

        {orderRegistered && orderNumber && (
          <div className="bg-[#fff6fa] rounded-3xl border border-[#ffe0ef] p-6 space-y-2">
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Número de orden</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-bubble text-2xl text-kawaii-pink tracking-wider">{orderNumber}</span>
              <button
                onClick={copyOrderNumber}
                className="p-2 rounded-xl bg-white border border-[#ffe0ef] hover:bg-[#ffe0ef] transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-400" />}
              </button>
            </div>
          </div>
        )}

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full bg-[#25D366] text-white py-4 rounded-full font-black text-lg tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_20px_rgba(37,211,102,0.3)]"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          ENVIAR COMPROBANTE
          <ExternalLink size={16} />
        </a>

        <div className="text-left">
          <OrderSummaryCard />
        </div>

        <button
          onClick={() => onComplete(formData)}
          className="w-full border-2 border-slate-200 text-slate-500 py-3 rounded-full font-bold text-sm hover:border-kawaii-pink hover:text-kawaii-pink transition-all cursor-pointer"
        >
          Volver a la tienda
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Payment Step
  // ─────────────────────────────────────────────

  if (step === 'payment') {
    const isManual = MANUAL_METHODS.includes(formData.paymentMethod);
    const isMercantil = MERCANTIL_METHODS.includes(formData.paymentMethod);
    const methodLabel = PAYMENT_METHODS.find((m) => m.id === formData.paymentMethod)?.title ?? formData.paymentMethod;

    return (
      <div className="space-y-8 max-w-2xl mx-auto pb-24">
        {/* Back to form */}
        <button
          onClick={() => { setStep('form'); setPaymentError(''); }}
          className="flex items-center gap-2 text-slate-500 hover:text-kawaii-pink font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} /> Volver al formulario
        </button>

        {/*
          Order number badge — only once the order actually exists.

          This used to render as soon as the customer reached the payment step,
          which meant a number was handed out for an order that had not been
          saved. Abandon the payment there and the customer walks away quoting a
          reference no one can look up. It now appears after ensureOrderSaved.
        */}
        {orderRegistered && orderNumber && (
          <div className="flex items-center justify-between bg-[#fff6fa] rounded-2xl px-5 py-3 border border-[#ffe0ef]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Orden</span>
            <span className="font-bubble text-kawaii-pink text-lg">{orderNumber}</span>
          </div>
        )}

        {/* Order Summary */}
        <OrderSummaryCard />

        {/*
          Bot check, solved while the customer reads the summary so it is
          already done by the time they press pay. Renders nothing at all when
          NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset. It sits on the payment step
          rather than the contact form because the token is short-lived (~5 min)
          and this is the step that ends in ensureOrderSaved.
        */}
        {turnstileEnabled() && (
          <div className="space-y-2">
            <Turnstile onToken={setTurnstileToken} />
          </div>
        )}

        {/* Payment error */}
        {paymentError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 font-bold text-sm space-y-3">
            <p className="text-center">⚠️ {paymentError}</p>

            {/* Name the products and say what is left, so the customer can fix
                the order here instead of guessing which line is the problem. */}
            {stockShortfalls.length > 0 && (
              <>
                <ul className="space-y-1 font-semibold text-red-500 text-xs">
                  {stockShortfalls.map((s) => (
                    <li key={s.productId}>
                      • <strong>{s.name ?? 'Producto'}</strong>: pediste {s.requested},{' '}
                      {s.available === 0 ? 'ya no queda ninguno' : `solo quedan ${s.available}`}.
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={applyStockShortfalls}
                  className="w-full bg-red-500 text-white py-2.5 rounded-full font-black text-xs tracking-widest hover:bg-red-600 transition-colors"
                >
                  AJUSTAR MI PEDIDO AUTOMATICAMENTE
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Manual Payment Methods ── */}
        {isManual && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 shadow-sm">
              <h3 className="font-black text-slate-800 text-xl">
                Pago con {methodLabel}
              </h3>

              {formData.paymentMethod === 'efectivo' && (
                <>
                  <p className="text-sm text-slate-600 font-bold leading-relaxed">
                    📍 <strong>Dirección:</strong> Carrera 19 con Avenida Vargas, CC Capital Plaza, Segundo piso, Local 80
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d448.8496132252689!2d-69.30971028957845!3d10.066832717819146!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e876772ee64127d%3A0xc32c2c566cc7dab7!2sCapital%20Plaza!5e1!3m2!1sen!2sus!4v1754191275022!5m2!1sen!2sus"
                      width="100%"
                      height="180"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-kawaii-pink to-kawaii-light-pink text-white py-2 px-4 rounded-xl text-sm font-bubble">
                    💳 ¡Aceptamos Punto!
                  </div>
                </>
              )}

              {formData.paymentMethod === 'zelle' && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 font-bold">Envía el pago a:</p>
                  <div className="bg-[#f8f4ff] rounded-2xl p-4 border border-purple-100">
                    <p className="font-black text-slate-700">📧 indigostores@gmail.com</p>
                    <p className="text-xs text-slate-400 font-bold mt-1">Zelle — Bank of America</p>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">
                    Monto exacto: <strong>${totalUsd.toFixed(2)} USD</strong>
                  </p>
                </div>
              )}

              {formData.paymentMethod === 'binance' && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 font-bold">Envía el pago a tu ID Binance:</p>
                  <div className="bg-[#fff9e6] rounded-2xl p-4 border border-amber-100">
                    <p className="font-black text-slate-700">🆔 ID: 123456789</p>
                    <p className="text-xs text-slate-400 font-bold mt-1">USDT / BNB Chain</p>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">
                    Monto exacto: <strong>${totalUsd.toFixed(2)} USD</strong>
                  </p>
                </div>
              )}

              {formData.paymentMethod === 'zinli' && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 font-bold">Envía el pago a:</p>
                  <div className="bg-[#f0fdf4] rounded-2xl p-4 border border-green-100">
                    <p className="font-black text-slate-700">📧 indigostores@gmail.com</p>
                    <p className="text-xs text-slate-400 font-bold mt-1">Zinli</p>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">
                    Monto exacto: <strong>${totalUsd.toFixed(2)} USD</strong>
                  </p>
                </div>
              )}

              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                Al hacer clic en el botón, se abrirá WhatsApp con los detalles de tu pedido.
                Envíanos el comprobante de pago para confirmar tu orden.
              </p>
            </div>

            <button
              onClick={handleManualPayment}
              className="w-full flex items-center justify-center gap-3 bg-[#25D366] text-white py-5 rounded-full font-black text-xl tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_20px_rgba(37,211,102,0.3)]"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              CONFIRMAR POR WHATSAPP
            </button>
          </div>
        )}

        {/* ── PayPal ── */}
        {formData.paymentMethod === 'paypal' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-xl">Pago con PayPal</h3>
              <p className="text-sm text-slate-500 font-semibold">
                Serás redirigido a PayPal para completar el pago de forma segura.
              </p>
              {!paypalLoaded && !paymentError && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-kawaii-pink border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div ref={paypalContainerRef} id="paypal-buttons-container" className="min-h-[100px]" />
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-kawaii-pink font-bold py-2">
                  <div className="w-4 h-4 border-2 border-kawaii-pink border-t-transparent rounded-full animate-spin" />
                  Procesando pago...
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Mercantil (Pago Móvil) ── */}
        {formData.paymentMethod === 'pago-movil' && (
          <form onSubmit={handleMercantilSubmit} className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-xl">Pago Móvil (Mercantil)</h3>
              <p className="text-sm text-slate-500 font-semibold">
                Ingresa el código OTP que recibirás en tu teléfono registrado en Mercantil.
              </p>
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Teléfono (el tuyo, registrado en Mercantil)</label>
                  <div className="w-full p-4 bg-[#fff6fa] border border-[#ffe0ef] rounded-2xl font-bold text-slate-700 text-sm">
                    {formData.phone || '—'}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Cédula</label>
                  <div className="w-full p-4 bg-[#fff6fa] border border-[#ffe0ef] rounded-2xl font-bold text-slate-700 text-sm">
                    {formData.id || '—'}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Monto a pagar</label>
                  <div className="w-full p-4 bg-[#fff6fa] border border-[#ffe0ef] rounded-2xl font-bold text-kawaii-pink text-sm">
                    Bs {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Código OTP *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Código de 6 dígitos"
                    maxLength={8}
                    required
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm focus:border-kawaii-pink tracking-widest text-center text-lg"
                    value={mercantilForm.otpCode}
                    onChange={(e) =>
                      setMercantilForm((prev) => ({
                        ...prev,
                        otpCode: e.target.value.replace(/[^0-9]/g, ''),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={isProcessing || !mercantilForm.otpCode}
              className="w-full bg-kawaii-pink text-white py-5 rounded-full font-black text-xl tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(255,107,157,0.3)]"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  PROCESANDO...
                </span>
              ) : 'CONFIRMAR PAGO MÓVIL'}
            </button>
          </form>
        )}

        {/* ── Mercantil (Débito / Crédito) ── */}
        {(formData.paymentMethod === 'debito' || formData.paymentMethod === 'credito') && (
          <form onSubmit={handleMercantilSubmit} className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-xl">
                Tarjeta {formData.paymentMethod === 'debito' ? 'de Débito' : 'de Crédito'} (Mercantil)
              </h3>
              <p className="text-sm text-slate-500 font-semibold">
                Solo tarjetas emitidas por Banco Mercantil.
              </p>

              <div className="space-y-3">
                {/* Card Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Número de tarjeta *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    required
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm focus:border-kawaii-pink tracking-widest"
                    value={mercantilForm.cardNumber}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
                      setMercantilForm((prev) => ({ ...prev, cardNumber: formatted }));
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Expiry */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">Vencimiento *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/AA"
                      maxLength={5}
                      required
                      className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm focus:border-kawaii-pink"
                      value={mercantilForm.expiryDate}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length >= 3) val = val.slice(0, 2) + '/' + val.slice(2, 4);
                        setMercantilForm((prev) => ({ ...prev, expiryDate: val }));
                      }}
                    />
                  </div>

                  {/* CVV */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">CVV *</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="•••"
                      maxLength={4}
                      required
                      className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm focus:border-kawaii-pink"
                      value={mercantilForm.cvv}
                      onChange={(e) =>
                        setMercantilForm((prev) => ({
                          ...prev,
                          cvv: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                    />
                  </div>
                </div>

                {/* OTP for Debit only */}
                {formData.paymentMethod === 'debito' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">Código OTP (Débito) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Código de 6 dígitos"
                      maxLength={8}
                      required
                      className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm focus:border-kawaii-pink tracking-widest text-center text-lg"
                      value={mercantilForm.otpCode}
                      onChange={(e) =>
                        setMercantilForm((prev) => ({
                          ...prev,
                          otpCode: e.target.value.replace(/[^0-9]/g, ''),
                        }))
                      }
                    />
                  </div>
                )}

                {/* Amount reminder */}
                <div className="bg-[#fff6fa] rounded-2xl p-3 border border-[#ffe0ef] text-center">
                  <p className="text-xs text-slate-400 font-bold">Monto a cobrar</p>
                  <p className="font-black text-kawaii-pink">
                    Bs {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing || !mercantilForm.cardNumber || !mercantilForm.expiryDate || !mercantilForm.cvv}
              className="w-full bg-kawaii-pink text-white py-5 rounded-full font-black text-xl tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(255,107,157,0.3)]"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  PROCESANDO...
                </span>
              ) : `PAGAR CON ${formData.paymentMethod === 'debito' ? 'DÉBITO' : 'CRÉDITO'}`}
            </button>
          </form>
        )}

        {/* ── Cashea ── */}
        {formData.paymentMethod === 'cashea' && (
          <CasheaPayment
            orderNumber={orderNumber}
            totalUsd={totalUsd}
            cedula={formData.id}
            ensureOrderSaved={() => ensureOrderSaved(orderNumber)}
            onConfirmed={(transactionId) => handlePaymentSuccess('cashea', transactionId)}
          />
        )}

        {/* ── Crypto (USDT / USDC) ── */}
        {formData.paymentMethod === 'crypto' && (
          <CryptoPayment
            orderNumber={orderNumber}
            totalUsd={totalUsd}
            authToken={token}
            ensureOrderSaved={async () => {
              setCompletedOrder(buildOrder(orderNumber));
              await ensureOrderSaved(orderNumber);
            }}
            onConfirmed={() => {
              finalizeCart();
              setStep('success');
            }}
          />
        )}

        {/* Scroll to top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-6 z-[1001] bg-[#ff6b9d] hover:bg-[#ff528c] text-white rounded-full w-12 h-12 flex items-center justify-center shadow-[0_4px_15px_rgba(255,107,157,0.3)] transition-all duration-300 cursor-pointer"
          >
            <ArrowUp size={24} />
          </button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Form Step (default)
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-12 max-w-2xl mx-auto pb-24">
      {/* Back button */}
      <div className="flex justify-start">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-kawaii-pink font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} /> Volver
        </button>
      </div>

      {/* 1. Order Summary */}
      <section className="space-y-6">
        <h2 className="text-3xl font-black text-center tracking-wide text-slate-800">
          Resumen de tu pedido
        </h2>
        <div className="space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border-2 border-slate-100 p-8 shadow-sm">
              <p className="text-slate-400 font-bold">Tu carrito está vacío</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {cartItems.map((item) => {
                  const itemPrices = calculatePrices(item.base_price_usd || item.USD || 0, rates);
                  const displayImage = item.image || item.Image;
                  return (
                    <div
                      key={item.id}
                      className="flex gap-4 items-center bg-[#fff6fa] p-4 rounded-3xl border border-[#ffe0ef] shadow-sm"
                    >
                      {displayImage && (
                        <img
                          src={displayImage}
                          className="w-12 h-12 rounded-xl object-cover border border-[#ffe0ef] bg-white flex-shrink-0"
                          alt={item.name}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-slate-800 truncate">{item.name}</h4>
                        {item.variant && (
                          <span className="text-xs text-kawaii-pink font-bold block mt-0.5">
                            Modelo:{' '}
                            {typeof item.variant === 'string'
                              ? item.variant
                              : (item.variant as any)?.variant_name}
                          </span>
                        )}
                        <div className="text-xs text-slate-400 mt-1 font-bold">
                          cantidad: {item.quantity}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-500">
                          ${itemPrices.usd.toFixed(2)} | Bs. {itemPrices.bs.toLocaleString()}
                        </div>
                        <div className="text-xs sm:text-sm font-black text-kawaii-pink mt-0.5">
                          total: ${(itemPrices.usd * item.quantity).toFixed(2)} | Bs.{' '}
                          {(itemPrices.bs * item.quantity).toLocaleString('es-VE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#fff0f7] rounded-3xl p-6 flex justify-between items-center shadow-sm border border-[#ffe0ef]">
                <span className="font-bubble text-xl text-kawaii-pink uppercase tracking-wide">total:</span>
                <span className="font-bubble text-xl text-kawaii-pink tracking-tight">
                  ${totalUsd.toFixed(2)} | Bs{' '}
                  {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="text-right text-xs text-slate-400 font-bold tracking-wide pr-2">
                {shippingChargesMessage}
                {shippingPriceMessage && <div>{shippingPriceMessage}</div>}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 2. Delivery Method */}
      <section className="space-y-6">
        <h3 className="text-2xl font-black tracking-wide text-slate-800">Método de entrega</h3>
        <div className="grid grid-cols-1 gap-4">
          {[
            {
              id: 'pickup-store' as const,
              label: 'Retirar en tienda',
              desc: 'Recoge tu pedido en nuestra tienda física',
              emoji: '🏪',
            },
            {
              id: 'delivery-home' as const,
              label: 'Entrega a domicilio',
              desc: 'Te llevamos tu pedido hasta tu casa',
              emoji: '🚚',
            },
            {
              id: 'delivery-national' as const,
              label: 'Envíos Nacionales',
              desc: 'Envío a cualquier parte del país',
              emoji: '📦',
            },
          ].map((opt) => (
            <div key={opt.id} className="relative">
              <input
                type="radio"
                id={opt.id}
                name="deliveryMethod"
                value={opt.id}
                checked={formData.deliveryMethod === opt.id}
                onChange={() => setFormData((prev) => ({ ...prev, deliveryMethod: opt.id }))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${
                  formData.deliveryMethod === opt.id
                    ? 'border-kawaii-pink bg-[#fff6fa] shadow-[0_4px_12px_rgba(255,107,157,0.15)]'
                    : 'border-slate-100 bg-white hover:border-kawaii-light-pink/50'
                }`}
              >
                <div className="text-2xl w-12 h-12 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100">
                  {opt.emoji}
                </div>
                <div className="flex-1">
                  <div className="font-black text-slate-700">{opt.label}</div>
                  <div className="text-xs text-slate-400 font-semibold">{opt.desc}</div>
                </div>
                {formData.deliveryMethod === opt.id && (
                  <Check size={18} className="text-kawaii-pink flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Delivery Information */}
      <section className="space-y-6">
        <h3 className="text-2xl font-black tracking-wide text-slate-800">Información de entrega</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">Nombre completo *</label>
              <input
                type="text"
                placeholder="Nombre completo"
                className={getInputClass('name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">Teléfono *</label>
              <input
                type="tel"
                placeholder="Teléfono"
                className={getInputClass('phone')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">Cédula *</label>
              <input
                type="text"
                placeholder="Solo números"
                className={getInputClass('id')}
                value={formData.id}
                onChange={handleCedulaChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">Email *</label>
              <input
                type="email"
                placeholder="Email"
                className={getInputClass('email')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          {/* Home Delivery Fields */}
          {formData.deliveryMethod === 'delivery-home' && (
            <div className="bg-[#f9fafb] border border-slate-200 rounded-3xl p-6 space-y-4 animate-in fade-in duration-300">
              <h5 className="text-md font-bold text-blue-600 flex items-center gap-2">📦 Entrega a Domicilio</h5>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Dirección completa *</label>
                <textarea
                  placeholder="Calle, número, sector, ciudad, estado"
                  className={getInputClass('address')}
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Instrucciones de entrega</label>
                <textarea
                  placeholder="Cómo llegar, puntos de referencia..."
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm h-20 resize-none focus:border-kawaii-pink"
                  rows={3}
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Texto adicional (opcional)</label>
                <textarea
                  placeholder="Información adicional..."
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm h-20 resize-none focus:border-kawaii-pink"
                  rows={2}
                  value={formData.emailText}
                  onChange={(e) => setFormData({ ...formData, emailText: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* National Shipping Fields */}
          {formData.deliveryMethod === 'delivery-national' && (
            <div className="bg-[#f9fafb] border border-slate-200 rounded-3xl p-6 space-y-4 animate-in fade-in duration-300">
              <h5 className="text-md font-bold text-green-600 flex items-center gap-2">🚚 Envíos Nacionales</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Empresa de envío *</label>
                  <select
                    value={formData.courier}
                    onChange={(e) => setFormData((prev) => ({ ...prev, courier: e.target.value, state: '', office: '' }))}
                    className={getInputClass('courier')}
                  >
                    <option value="">Selecciona una empresa</option>
                    {uniqueCouriers.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Estado *</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value, office: '' }))}
                    disabled={!formData.courier}
                    className={getInputClass('state')}
                  >
                    <option value="">
                      {!formData.courier ? 'Primero selecciona empresa' : 'Selecciona un estado'}
                    </option>
                    {statesForCourier.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Oficina *</label>
                  <select
                    value={formData.office}
                    onChange={(e) => setFormData((prev) => ({ ...prev, office: e.target.value }))}
                    disabled={!formData.state}
                    className={getInputClass('office')}
                  >
                    <option value="">
                      {!formData.state ? 'Primero selecciona un estado' : 'Selecciona una oficina'}
                    </option>
                    {officesForStateAndCourier.map((o) => (
                      <option key={o.id} value={o.office}>{o.office}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Texto adicional (opcional)</label>
                  <textarea
                    placeholder="Información adicional..."
                    value={formData.emailTextNational}
                    onChange={(e) => setFormData((prev) => ({ ...prev, emailTextNational: e.target.value }))}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm h-20 resize-none focus:border-kawaii-pink"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Payment Method */}
      <section className="space-y-6">
        <h3 className="text-2xl font-black tracking-wide text-slate-800">Método de pago</h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              id={`payment_method_${method.id}`}
              type="button"
              onClick={() => setFormData({ ...formData, paymentMethod: method.id })}
              className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                formData.paymentMethod === method.id
                  ? 'border-kawaii-pink bg-[#ffe0ef] font-bold shadow-sm'
                  : 'border-slate-100 bg-white hover:border-kawaii-light-pink/30'
              }`}
            >
              <span className="text-slate-700 text-sm font-bold">{method.title}</span>
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: method.svg }}
                />
                {formData.paymentMethod === method.id && (
                  <Check size={16} className="text-kawaii-pink flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Efectivo address widget */}
        {formData.paymentMethod === 'efectivo' && (
          <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(255,107,157,0.1)] border border-[#ffe0ef]/80 space-y-4 animate-in fade-in duration-300 text-center">
            <h4 className="text-lg font-black text-kawaii-pink tracking-wide">
              💵 Dirección para Recoger (◕‿◕)
            </h4>
            <p className="text-sm text-slate-700 font-bold leading-relaxed max-w-md mx-auto">
              📍 Carrera 19 con Avenida Vargas, CC Capital Plaza, Segundo piso, Local 80
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d448.8496132252689!2d-69.30971028957845!3d10.066832717819146!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e876772ee64127d%3A0xc32c2c566cc7dab7!2sCapital%20Plaza!5e1!3m2!1sen!2sus!4v1754191275022!5m2!1sen!2sus"
                width="100%"
                height="200"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-kawaii-pink to-kawaii-light-pink text-white py-3 px-6 rounded-2xl shadow-sm max-w-xs mx-auto">
              <span className="text-xl">💳</span>
              <span className="font-bubble text-lg">¡Aceptamos Punto! (◕‿◕)</span>
            </div>
          </div>
        )}
      </section>

      {/* 5. Continue Button */}
      <div className="pt-6">
        <button
          id="checkout-continue-btn"
          onClick={handleFormSubmit}
          disabled={cartItems.length === 0}
          className="w-full bg-kawaii-pink text-white py-5 rounded-full font-black text-xl tracking-widest kawaii-shadow hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          CONTINUAR CON LA COMPRA
        </button>
      </div>

      {/* Floating scroll-to-top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-6 z-[1001] bg-[#ff6b9d] hover:bg-[#ff528c] text-white rounded-full w-12 h-12 flex items-center justify-center shadow-[0_4px_15px_rgba(255,107,157,0.3)] transition-all duration-300 transform scale-100 hover:scale-110 active:scale-95 cursor-pointer animate-in fade-in zoom-in duration-300"
        >
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  );
}
