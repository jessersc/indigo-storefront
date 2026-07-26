// Vercel API Route: GET /api/paypal/config
// Serves the PayPal Client ID to the browser (safe to expose — this is a public key)
// Ported from indigo/api/config/paypal.js

import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? '';

  return NextResponse.json(
    {
      success: true,
      clientId,
      configured: !!clientId,
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
