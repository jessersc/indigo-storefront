// Vercel API Route: POST /api/paypal/create
// Creates a PayPal order and returns the order ID used to initialize the PayPal JS SDK.
// Ported from indigo/api/paypal/paypal_create.js

import { NextRequest, NextResponse } from 'next/server';

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
    const { amount } = body as { amount: string };

    if (!amount) {
      return NextResponse.json(
        { success: false, error: 'amount is required' },
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

    const orderRes = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: amount,
            },
          },
        ],
      }),
    });

    const data = await orderRes.json();

    if (!orderRes.ok) {
      console.error('PayPal create rejected:', JSON.stringify(data));
      return NextResponse.json(
        { success: false, error: 'create_failed' },
        { status: orderRes.status, headers: corsHeaders },
      );
    }

    // The SDK only needs the order id to hand back on approval.
    return NextResponse.json({ id: data?.id ?? null }, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('PayPal create error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
