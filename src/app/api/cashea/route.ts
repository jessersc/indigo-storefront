// Vercel API Route: /api/cashea
// Consolidated Cashea proxy — handles all Cashea endpoints via ?action= query param.
// Ported from indigo/api/cashea-handler.js
//
// Actions:
//   GET  ?action=config                     → Returns public API key + client ID
//   GET  ?action=orders&idNumber=<id>       → Fetch order from Cashea
//   POST ?action=confirm-payment&idNumber=<id> → Confirm down payment (body: { amount })
//   DELETE ?action=cancel-order&idNumber=<id>  → Cancel order

import { NextRequest, NextResponse } from 'next/server';
import { confirmPaymentWithWorker, verifyOrderOwner } from '../../../lib/confirm-payment';

// Same-origin only. This route spends the store's Cashea merchant credentials,
// so it must not be callable from another site.
const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function buildCasheaHeaders(): Record<string, string> {
  const CASHEA_PRIVATE_API_KEY =
    process.env.CASHEA_PRIVATE_API_KEY ?? process.env.PRIVATE_API_KEY ?? '';

  const headers: Record<string, string> = {
    Authorization: `ApiKey ${CASHEA_PRIVATE_API_KEY}`,
  };

  if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET;
  }
  if (process.env.CF_ACCESS_JWT) {
    headers['CF-Access-Jwt-Assertion'] = process.env.CF_ACCESS_JWT;
  }

  return headers;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const idNumber = searchParams.get('idNumber');
  const CASHEA_API_URL =
    process.env.CASHEA_BASE_URL ??
    process.env.CASHEA_API_URL ??
    'https://external.cashea.app';

  try {
    if (action === 'config') {
      const publicApiKey =
        process.env.CASHEA_PUBLIC_API_KEY ?? process.env.PUBLIC_API_KEY ?? '';
      const externalClientId =
        process.env.CASHEA_CLIENT_ID ?? process.env.EXTERNAL_CLIENT_ID ?? '';

      return NextResponse.json(
        {
          success: true,
          publicApiKey,
          externalClientId,
          store: { id: 21977, name: 'Web Indigo Store', enabled: true },
          redirectUrl: 'https://indigostores.com/checkout',
          configured: !!(publicApiKey && externalClientId),
        },
        { headers: corsHeaders }
      );
    }

    if (action === 'orders') {
      const orderNumber = searchParams.get('orderNumber');
      if (!idNumber || !orderNumber) {
        return NextResponse.json(
          { error: 'idNumber and orderNumber are required' },
          { status: 400, headers: corsHeaders }
        );
      }
      // A cedula is not a secret, so it alone must not unlock a Cashea order.
      // The caller has to name an unpaid order in our own database placed with
      // that cedula -- i.e. prove they are the person who just checked out.
      if (!(await verifyOrderOwner(orderNumber, idNumber))) {
        return NextResponse.json(
          { error: 'forbidden' },
          { status: 403, headers: corsHeaders }
        );
      }
      // Cashea keys its orders on the cedula, so the path segment must be a
      // plain number -- never anything that could alter the URL's shape.
      if (!/^\d{1,20}$/.test(idNumber)) {
        return NextResponse.json(
          { error: 'invalid idNumber' },
          { status: 400, headers: corsHeaders }
        );
      }

      const orderResponse = await fetch(`${CASHEA_API_URL}/orders/${idNumber}`, {
        method: 'GET',
        headers: buildCasheaHeaders(),
      });
      const orderData = await orderResponse.json();
      return NextResponse.json(orderData, {
        status: orderResponse.status,
        headers: corsHeaders,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action for GET. Use: config, orders' },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Cashea GET error:', err);
    return NextResponse.json(
      { error: 'Internal server error', action: action ?? 'unknown' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const idNumber = searchParams.get('idNumber');
  const CASHEA_API_URL =
    process.env.CASHEA_BASE_URL ??
    process.env.CASHEA_API_URL ??
    'https://external.cashea.app';

  try {
    if (action === 'confirm-payment') {
      if (!idNumber) {
        return NextResponse.json(
          { error: 'idNumber is required' },
          { status: 400, headers: corsHeaders }
        );
      }

      const body = await req.json();
      const { amount, orderNumber } = body as { amount: number; orderNumber?: string };

      if (!amount || !orderNumber) {
        return NextResponse.json(
          { error: 'amount and orderNumber are required' },
          { status: 400, headers: corsHeaders }
        );
      }
      // Same gate as the lookup: capturing against a cedula must require an
      // unpaid order of ours placed with it.
      if (!(await verifyOrderOwner(orderNumber, idNumber))) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: corsHeaders });
      }
      if (!/^\d{1,20}$/.test(idNumber)) {
        return NextResponse.json(
          { error: 'invalid idNumber' },
          { status: 400, headers: corsHeaders }
        );
      }

      const confirmResponse = await fetch(
        `${CASHEA_API_URL}/orders/${idNumber}/down-payment`,
        {
          method: 'POST',
          headers: { ...buildCasheaHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: parseFloat(String(amount)) }),
        }
      );
      const confirmData = await confirmResponse.json();

      // Cashea captured the down payment, so the order is real. As with the
      // other gateways, this route confirms the Worker directly -- the browser
      // is never believed about a payment.
      if (confirmResponse.ok && orderNumber) {
        await confirmPaymentWithWorker({
          orderNumber,
          method: 'cashea',
          transactionId:
            (confirmData as any)?.id ?? (confirmData as any)?.paymentId ?? String(idNumber),
        });
      }

      return NextResponse.json(confirmData, {
        status: confirmResponse.status,
        headers: corsHeaders,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action for POST. Use: confirm-payment' },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Cashea POST error:', err);
    return NextResponse.json(
      { error: 'Internal server error', action: action ?? 'unknown' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// The DELETE (?action=cancel-order) handler was removed deliberately. Nothing
// in the app called it, and it let anyone cancel any Cashea order given only a
// cedula -- which is not a secret. If order cancellation is ever needed, it
// belongs behind the same ownership check the lookup uses, not on a bare
// cedula.
