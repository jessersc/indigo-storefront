// Vercel API Route: POST /api/paypal/capture
// Captures an approved PayPal order. Called after the buyer approves the payment
// in the PayPal JS SDK buttons flow.
// Ported from indigo/api/paypal/paypal_capture.js

import { NextRequest, NextResponse } from 'next/server';
import { confirmPaymentWithWorker } from '../../../../lib/confirm-payment';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // orderNumber is the store's own order, already saved as pending before the
    // buyer was sent to PayPal. It is what this route confirms once PayPal says
    // the capture completed -- the browser never gets to make that call.
    const { orderID, orderNumber } = body as { orderID: string; orderNumber?: string };

    if (!orderID) {
      return NextResponse.json(
        { success: false, error: 'orderID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_SECRET;
    const apiBase = process.env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com';

    if (!clientId || !secret) {
      return NextResponse.json(
        { success: false, error: 'PayPal credentials not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

    const captureRes = await fetch(
      `${apiBase}/v2/checkout/orders/${orderID}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await captureRes.json();

    if (!captureRes.ok) {
      console.error('PayPal capture rejected:', orderNumber, JSON.stringify(data));
      return NextResponse.json(
        { success: false, error: 'capture_failed' },
        { status: captureRes.status, headers: corsHeaders },
      );
    }

    // PayPal only counts as paid when it says COMPLETED. Anything else
    // (PENDING, DECLINED) leaves the order pending for an admin to look at.
    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
    const completed = data?.status === 'COMPLETED' || capture?.status === 'COMPLETED';

    if (completed && orderNumber) {
      await confirmPaymentWithWorker({
        orderNumber,
        method: 'paypal',
        transactionId: capture?.id ?? data?.id ?? null,
        amountUsd: Number(capture?.amount?.value) || undefined,
      });
    }

    // Only what the checkout needs. PayPal's full capture payload carries payer
    // name/email/address and internal links; none of it belongs in the client.
    return NextResponse.json(
      { success: true, status: data?.status ?? capture?.status ?? null, id: capture?.id ?? data?.id ?? null },
      { status: 200, headers: corsHeaders },
    );
  } catch (err: any) {
    console.error('PayPal capture error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
