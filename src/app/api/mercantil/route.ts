// Vercel API Route: POST /api/mercantil
// Processes Mercantil bank payments: Pago Móvil (C2P), Débito (TDD), Crédito (TDC).
// Uses AES-128-ECB encryption via Node.js crypto — ported from:
//   indigo/api/mercantil/mercantil_payment.js
//   indigo/api/mercantil/payment.js

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { confirmPaymentWithWorker, failPaymentWithWorker } from '../../../lib/confirm-payment';
import {
  normalizeCedula,
  validateCedula,
  normalizeVenezuelanMobile,
  validateVenezuelanMobile,
} from '../../../lib/validation';
import { isPaymentSuccessful } from '../../../lib/mercantil-result';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// ─────────────────────────────────────────────
// Encryption (exact copy from Mercantil docs)
// ─────────────────────────────────────────────

function encryptData(message: string, key: string): string {
  const algorithm = 'aes-128-ecb';
  const hash = crypto.createHash('sha256');
  hash.update(key);
  const keyString = hash.copy().digest('hex');
  const firstHalf = keyString.slice(0, keyString.length / 2);
  const keyHex = Buffer.from(firstHalf, 'hex');

  const cipher = crypto.createCipheriv(algorithm, keyHex, null);
  let ciphertext = cipher.update(message, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  return ciphertext;
}

function generateInvoiceNumber(): string {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

// Convert from MMYY or MM/YY to YYYY/MM
function convertDateFormat(mmYyDate: string): string {
  let month: string, year: string;
  if (mmYyDate.includes('/')) {
    [month, year] = mmYyDate.split('/');
  } else if (mmYyDate.length === 4) {
    month = mmYyDate.substring(0, 2);
    year = mmYyDate.substring(2, 4);
  } else {
    return mmYyDate;
  }
  return `20${year}/${month}`;
}

// ─────────────────────────────────────────────
// Config builders
// ─────────────────────────────────────────────

function getAPIUrls() {
  return {
    c2p: process.env.MERCANTIL_C2P_URL,
    pay: process.env.MERCANTIL_PAY_URL,
  };
}

function getC2PConfig() {
  return {
    encryptionKey: process.env.MERCANTIL_C2P_ENCRYPTION_KEY ?? '',
    merchantId: parseInt(process.env.MERCANTIL_C2P_MERCHANT_ID ?? '0'),
    clientId: process.env.MERCANTIL_C2P_CLIENT_ID ?? '',
    integratorId: parseInt(process.env.MERCANTIL_INTEGRATOR_ID ?? '0'),
    terminalId: process.env.MERCANTIL_TERMINAL_ID ?? '',
    originPhone: process.env.MERCANTIL_ORIGIN_PHONE ?? '',
  };
}

function getCardsConfig() {
  return {
    encryptionKey: process.env.MERCANTIL_CARDS_ENCRYPTION_KEY ?? '',
    merchantId: parseInt(process.env.MERCANTIL_CARDS_MERCHANT_ID ?? '0'),
    clientId: process.env.MERCANTIL_CARDS_CLIENT_ID ?? '',
    integratorId: parseInt(process.env.MERCANTIL_INTEGRATOR_ID ?? '0'),
    terminalId: process.env.MERCANTIL_TERMINAL_ID ?? '',
  };
}

// Parity with the reference: refuse to process when the relevant method is not
// configured, rather than sending a request built from empty keys.
function c2pConfigured(): boolean {
  return Boolean(
    process.env.MERCANTIL_C2P_ENCRYPTION_KEY &&
    process.env.MERCANTIL_C2P_MERCHANT_ID &&
    process.env.MERCANTIL_C2P_CLIENT_ID &&
    process.env.MERCANTIL_ORIGIN_PHONE &&
    process.env.MERCANTIL_C2P_URL,
  );
}

function cardsConfigured(): boolean {
  return Boolean(
    process.env.MERCANTIL_CARDS_ENCRYPTION_KEY &&
    process.env.MERCANTIL_CARDS_MERCHANT_ID &&
    process.env.MERCANTIL_CARDS_CLIENT_ID &&
    process.env.MERCANTIL_PAY_URL,
  );
}

// ─────────────────────────────────────────────
// Payment processors
// ─────────────────────────────────────────────

async function processPagoMovil(paymentData: Record<string, string>, clientIP: string, browserAgent: string) {
  const apiUrls = getAPIUrls();
  if (!apiUrls.c2p) throw new Error('MERCANTIL_C2P_URL environment variable is not set');

  const config = getC2PConfig();
  const invoiceNumber = paymentData.invoiceNumber || generateInvoiceNumber();

  const requestBody = {
    merchant_identify: {
      integratorId: config.integratorId,
      merchantId: config.merchantId,
      terminalId: config.terminalId,
    },
    client_identify: {
      ipaddress: clientIP,
      browser_agent: browserAgent,
      mobile: { manufacturer: 'Samsung' },
    },
    transaction_c2p: {
      amount: parseFloat(paymentData.amount),
      currency: 'ves',
      destination_bank_id: 105,
      destination_id: encryptData(paymentData.customerCedula, config.encryptionKey),
      destination_mobile_number: encryptData(paymentData.customerPhone, config.encryptionKey),
      origin_mobile_number: encryptData(config.originPhone, config.encryptionKey),
      payment_reference: '',
      trx_type: 'compra',
      payment_method: 'c2p',
      invoice_number: String(invoiceNumber),
      twofactor_auth: encryptData(paymentData.otpCode, config.encryptionKey),
    },
  };

  console.log('Sending C2P request to Mercantil');
  const response = await fetch(apiUrls.c2p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-IBM-Client-ID': config.clientId },
    body: JSON.stringify(requestBody),
  });
  return await response.json();
}

async function processCardPayment(
  paymentData: Record<string, string>,
  paymentMethod: 'tdc' | 'tdd',
  clientIP: string,
  browserAgent: string
) {
  const apiUrls = getAPIUrls();
  if (!apiUrls.pay) throw new Error('MERCANTIL_PAY_URL environment variable is not set');

  const config = getCardsConfig();
  const invoiceNumber = paymentData.invoiceNumber || generateInvoiceNumber();
  const isDebitCard = paymentMethod === 'tdd';

  const requestBody: any = {
    merchant_identify: {
      integratorId: config.integratorId,
      merchantId: config.merchantId,
      terminalId: config.terminalId,
    },
    client_identify: {
      ipaddress: clientIP,
      browser_agent: browserAgent,
      mobile: { manufacturer: 'Samsung' },
    },
    transaction: {
      trx_type: 'compra',
      payment_method: paymentMethod,
      customer_id: paymentData.customerCedula,
      card_number: paymentData.cardNumber,
      expiration_date: convertDateFormat(paymentData.expiryDate),
      cvv: encryptData(paymentData.cvv, config.encryptionKey),
      currency: 'ves',
      amount: parseFloat(paymentData.amount),
      invoice_number: invoiceNumber,
    },
  };

  if (isDebitCard && paymentData.otpCode) {
    requestBody.transaction.twofactor_auth = encryptData(paymentData.otpCode, config.encryptionKey);
    requestBody.transaction.account_type = 'cc';
  }

  console.log('Sending card payment request to Mercantil:', { type: paymentMethod });
  const response = await fetch(apiUrls.pay, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-IBM-Client-ID': config.clientId },
    body: JSON.stringify(requestBody),
  });
  return await response.json();
}

// ─────────────────────────────────────────────
// Success detection (from original indigo code)
// ─────────────────────────────────────────────

// Approval detection lives in ../../../lib/mercantil-result so it can be tested
// without the Next runtime. See that file for why it is strict.

// ─────────────────────────────────────────────
// Main Route Handler
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, string>;

    const clientIP =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
    const userAgent = req.headers.get('user-agent') ?? '';

    // Extract short browser name (Mercantil requires ≤ ~20 chars)
    let browser = 'Chrome';
    let version = '18.1.3';
    if (userAgent.includes('Firefox/')) {
      browser = 'Firefox';
      const m = userAgent.match(/Firefox\/(\d+\.\d+)/);
      version = m ? m[1] + '.0' : '95.0.0';
    } else if (userAgent.includes('Edg/')) {
      browser = 'Edge';
      const m = userAgent.match(/Edg\/(\d+\.\d+)/);
      version = m ? m[1] + '.0' : '96.0.0';
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
      const m = userAgent.match(/Version\/(\d+\.\d+)/);
      version = m ? m[1] + '.0' : '15.0.0';
    } else if (userAgent.includes('Chrome/')) {
      const m = userAgent.match(/Chrome\/(\d+\.\d+)/);
      version = m ? m[1] + '.0' : '96.0.0';
    }
    const browserAgent = `${browser} ${version}`;

    if (!body.paymentMethod || !body.amount || !body.customerCedula) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: paymentMethod, amount, customerCedula' },
        { status: 400, headers: corsHeaders }
      );
    }

    /*
      Validate identity fields BEFORE spending a call on the bank.

      Previously anything non-empty was forwarded, encrypted, and sent — so a
      made-up cedula and phone produced a real request whose reply was then
      misread as an approval. Rejecting malformed input here removes the whole
      class of problem: the bank is only ever asked about numbers that could
      plausibly exist, and the customer gets a precise message instead of a
      generic decline.
    */
    const cedulaError = validateCedula(body.customerCedula);
    if (cedulaError) {
      return NextResponse.json(
        { success: false, error: cedulaError, field: 'customerCedula' },
        { status: 400, headers: corsHeaders }
      );
    }
    body.customerCedula = normalizeCedula(body.customerCedula);

    const amountNumber = Number(body.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { success: false, error: 'El monto no es valido.', field: 'amount' },
        { status: 400, headers: corsHeaders }
      );
    }

    let result: any;

    switch (body.paymentMethod) {
      case 'pago-movil':
      case 'c2p':
        if (!c2pConfigured()) {
          return NextResponse.json(
            { success: false, error: 'Pago Móvil (C2P) no está configurado.' },
            { status: 503, headers: corsHeaders }
          );
        }
        if (!body.customerPhone || !body.otpCode) {
          return NextResponse.json(
            { success: false, error: 'Pago Móvil requires customerPhone and otpCode' },
            { status: 400, headers: corsHeaders }
          );
        }
        {
          // C2P settles between two Venezuelan mobile lines, so the number has
          // to be one that can actually receive the debit — and in local
          // `04121234567` form, which is what Mercantil matches on. An E.164
          // (+58...) value silently matches no account.
          const phoneError = validateVenezuelanMobile(body.customerPhone);
          if (phoneError) {
            return NextResponse.json(
              { success: false, error: phoneError, field: 'customerPhone' },
              { status: 400, headers: corsHeaders }
            );
          }
          body.customerPhone = normalizeVenezuelanMobile(body.customerPhone);

          if (!/^\d{4,8}$/.test(String(body.otpCode).trim())) {
            return NextResponse.json(
              { success: false, error: 'La clave temporal no es valida.', field: 'otpCode' },
              { status: 400, headers: corsHeaders }
            );
          }
        }
        result = await processPagoMovil(body, clientIP, browserAgent);
        break;

      case 'debito':
      case 'tdd':
        if (!cardsConfigured()) {
          return NextResponse.json(
            { success: false, error: 'Pago con tarjeta no está configurado.' },
            { status: 503, headers: corsHeaders }
          );
        }
        if (!body.cardNumber || !body.expiryDate || !body.cvv) {
          return NextResponse.json(
            { success: false, error: 'Debit card requires cardNumber, expiryDate, cvv' },
            { status: 400, headers: corsHeaders }
          );
        }
        result = await processCardPayment(body, 'tdd', clientIP, browserAgent);
        break;

      case 'credito':
      case 'tdc':
        if (!cardsConfigured()) {
          return NextResponse.json(
            { success: false, error: 'Pago con tarjeta no está configurado.' },
            { status: 503, headers: corsHeaders }
          );
        }
        if (!body.cardNumber || !body.expiryDate || !body.cvv) {
          return NextResponse.json(
            { success: false, error: 'Credit card requires cardNumber, expiryDate, cvv' },
            { status: 400, headers: corsHeaders }
          );
        }
        result = await processCardPayment(body, 'tdc', clientIP, browserAgent);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Invalid payment method: ${body.paymentMethod}` },
          { status: 400, headers: corsHeaders }
        );
    }

    const success = isPaymentSuccessful(result);

    if (success) {
      const transactionId =
        result?.transaction_response?.payment_reference ??
        result?.infoMsg?.guId ??
        result?.transaction?.id ??
        null;

      // The bank approved it, so this route -- not the browser -- tells the
      // Worker the order is paid. amountUsd is omitted: Mercantil charges in
      // Bs, and the Worker already knows what the order is worth.
      if (body.orderNumber) {
        await confirmPaymentWithWorker({
          orderNumber: body.orderNumber,
          method: body.paymentMethod,
          transactionId,
        });
      }

      // Deliberately NOT returning the raw bank payload: it carries merchant
      // identifiers and internal bank fields the browser has no use for. The
      // full response is logged server-side for support instead.
      return NextResponse.json(
        {
          success: true,
          message: 'Pago procesado exitosamente',
          transactionId,
          invoiceNumber:
            result?.transaction_response?.invoice_number ??
            result?.invoice_number ??
            body.invoiceNumber ??
            null,
          timestamp: new Date().toISOString(),
        },
        { status: 200, headers: corsHeaders }
      );
    } else {
      // Declined: hand the reserved stock back now rather than letting the
      // 2-hour hold sit on it.
      if (body.orderNumber) {
        await failPaymentWithWorker(body.orderNumber, 'bank_declined');
      }

      // Log the full rejection for support; give the customer only the bank's
      // human-readable reason.
      console.error('Mercantil declined:', body.orderNumber, JSON.stringify(result));

      // 402, not 400. A declined payment is a well-formed request that the bank
      // refused — returning 400 made every ordinary decline look like a client
      // bug in the browser console, which is what "POST /api/mercantil 400"
      // was during testing.
      return NextResponse.json(
        {
          success: false,
          message: 'Pago rechazado',
          error:
            result?.status?.descTech ??
            result?.status?.descUser ??
            result?.error_list?.[0]?.description ??
            'El banco rechazo el pago. Verifica tus datos e intenta de nuevo.',
        },
        { status: 402, headers: corsHeaders }
      );
    }
  } catch (err: any) {
    console.error('Mercantil payment error:', err);
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor', error: 'An error occurred' },
      { status: 500, headers: corsHeaders }
    );
  }
}
