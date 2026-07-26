'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStorefront } from '../../context/StorefrontContext';
import CheckoutFlow from '../../components/CheckoutFlow';
import { validateDiscount, discountReasonEs } from '../../lib/discount-api';
import { calculatePrices } from '../../lib/currency';

export default function CheckoutPage() {
  const router = useRouter();
  // Only the lines the customer ticked in the cart are being bought, so the
  // whole checkout -- totals, discount base and the order itself -- works from
  // `selectedCartItems`, not the full cart.
  const { selectedCartItems: cartItems, rates } = useStorefront();

  // Charge the shelf price, not the cost basis. base_price_usd is only the
  // input the shelf price is derived from -- summing it here is what made the
  // order total disagree with its own line items. Bs is summed per line from
  // the same calculation rather than re-derived from the rounded USD total, so
  // the two figures always match what the cart showed.
  const { subtotalUsd, subtotalBs } = cartItems.reduce(
    (acc, item) => {
      const prices = calculatePrices(item.base_price_usd ?? item.USD ?? 0, rates);
      acc.subtotalUsd += prices.usd * item.quantity;
      acc.subtotalBs += prices.bs * item.quantity;
      return acc;
    },
    { subtotalUsd: 0, subtotalBs: 0 },
  );

  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; amountUsd: number } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [checking, setChecking] = useState(false);

  const apply = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setDiscountError('');
    const result = await validateDiscount(code.trim(), subtotalUsd);
    if (result.valid && result.amountUsd != null) {
      setApplied({ code: result.code!, amountUsd: result.amountUsd });
    } else {
      setApplied(null);
      setDiscountError(discountReasonEs(result.reason, result.minSubtotalUsd));
    }
    setChecking(false);
  };

  const removeDiscount = () => { setApplied(null); setCode(''); setDiscountError(''); };

  const discountUsd = applied?.amountUsd ?? 0;
  const totalUsd = Math.max(0, subtotalUsd - discountUsd);
  // Scale Bs by the same proportion the discount took off the USD total.
  const totalBs = subtotalUsd > 0 ? subtotalBs * (totalUsd / subtotalUsd) : 0;

  const handleComplete = () => router.push('/');

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {cartItems.length > 0 && (
        <div className="max-w-2xl mx-auto mb-8 bg-white rounded-3xl border border-[#ffe0ef] p-5 space-y-3">
          <h3 className="font-black text-slate-700 text-sm">Codigo de descuento</h3>
          {applied ? (
            <div className="flex items-center justify-between bg-[#f0fdf4] border border-green-200 rounded-2xl px-4 py-3">
              <div>
                <p className="font-black text-green-700 text-sm">{applied.code} aplicado</p>
                <p className="text-xs text-green-600 font-bold">-${applied.amountUsd.toFixed(2)}</p>
              </div>
              <button onClick={removeDiscount} className="text-xs text-slate-500 font-bold hover:text-red-500">Quitar</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: BIENVENIDA10"
                className="flex-1 p-3 rounded-2xl border-2 border-[#ffd2e9] focus:border-kawaii-pink outline-none font-bold text-slate-700 text-sm uppercase"
              />
              <button onClick={apply} disabled={checking || !code.trim()} className="px-5 rounded-2xl bg-kawaii-pink text-white font-black text-sm disabled:opacity-60">
                {checking ? '...' : 'Aplicar'}
              </button>
            </div>
          )}
          {discountError && <p className="text-red-500 text-xs font-bold">{discountError}</p>}
          {applied && (
            <div className="flex justify-between text-sm font-bold text-slate-600 pt-2 border-t border-[#ffe0ef]">
              <span>Total con descuento</span>
              <span className="text-kawaii-pink">${totalUsd.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <CheckoutFlow
        totalUsd={totalUsd}
        totalBs={totalBs}
        discountCode={applied?.code}
        onComplete={handleComplete}
        onBack={() => router.back()}
      />
    </main>
  );
}
