/**
 * CurrencyEngine: the store's 3-tier pricing model (Venezuela).
 *
 *   usd_real = the cost basis. An INPUT only -- never shown to customers.
 *   usd      = customRound(usd_real * paralelo_fijo / bcv_fijo)   <- shelf price
 *   bs       = customRound(usd * bcv_diario)                      <- from the ROUNDED usd
 *
 * Both conversions pass through customRound, and Bs is derived from the already
 * rounded USD (not the raw figure) -- that ordering is what reproduces the
 * store's real price list. Example with 109.77 / 170 / 396.37:
 *   6.00 -> 6 * 1.54869 = 9.2921 -> 9.50 -> 9.50 * 396.37 = 3765.515 -> 3766.00
 */

export interface ExchangeRates {
  bcv_fijo: number;
  paralelo_fijo: number;
  bcv_diario: number;
}

export interface CalculatedPrices {
  usd_real: number;
  usd: number;
  bs: number;
}

/**
 * The store's rounding rule (spreadsheet formula, mirrored from the admin's
 * utils/priceRounding.ts and the Worker's customRoundSql -- keep all three in
 * step): fraction < 0.1 rounds down, <= 0.5 rounds to .50, otherwise up.
 */
export function customRound(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const whole = Math.floor(value);
  const fraction = value - whole;
  if (fraction < 0.1) return whole;
  if (fraction <= 0.5) return whole + 0.5;
  return whole + 1;
}

export function calculatePrices(basePriceUsd: number, rates: ExchangeRates): CalculatedPrices {
  if (!basePriceUsd || !rates.bcv_fijo || !rates.paralelo_fijo || !rates.bcv_diario) {
    return { usd_real: basePriceUsd, usd: 0, bs: 0 };
  }

  const usd = customRound(basePriceUsd * (rates.paralelo_fijo / rates.bcv_fijo));
  const bs = customRound(usd * rates.bcv_diario);

  return { usd_real: basePriceUsd, usd, bs };
}
