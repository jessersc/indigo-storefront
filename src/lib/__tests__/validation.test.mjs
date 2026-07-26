/**
 * Field-validation tests.
 *
 *   node --experimental-strip-types src/lib/__tests__/validation.test.mjs
 *
 * Focus is the Venezuelan mobile rule added for Pago Movil. C2P debits a
 * specific mobile line, so a number that cannot receive the debit is a
 * guaranteed decline — and previously any non-empty string was forwarded to the
 * bank, which is half of how a bogus phone number got a payment accepted.
 */

import assert from 'node:assert/strict';
import {
  validateVenezuelanMobile,
  normalizeVenezuelanMobile,
  validateCedula,
  normalizeCedula,
} from '../validation.ts';

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.error(`  FAIL ${name}`); }
}

function accepts(fn, name, value) {
  ok(`${name}: accepts ${JSON.stringify(value)}`, fn(value) === null);
}
function rejects(fn, name, value) {
  ok(`${name}: rejects ${JSON.stringify(value)}`, typeof fn(value) === 'string');
}

console.log('\nVENEZUELAN MOBILE');

for (const p of ['0412', '0414', '0416', '0424', '0426']) {
  accepts(validateVenezuelanMobile, 'valid prefix', `${p}1234567`);
}

// Accepted input shapes that all mean the same line.
accepts(validateVenezuelanMobile, 'with spaces', '0412 123 4567');
accepts(validateVenezuelanMobile, 'with dashes', '0412-123-4567');
accepts(validateVenezuelanMobile, 'E.164', '+584121234567');
accepts(validateVenezuelanMobile, '00 prefix', '00584121234567');
accepts(validateVenezuelanMobile, 'no trunk zero', '4121234567');

rejects(validateVenezuelanMobile, 'landline prefix', '02121234567');
rejects(validateVenezuelanMobile, 'unissued mobile prefix', '04001234567');
rejects(validateVenezuelanMobile, 'too short', '0412123');
rejects(validateVenezuelanMobile, 'too long', '041212345678');
rejects(validateVenezuelanMobile, 'letters', '0412ABCDEFG');
rejects(validateVenezuelanMobile, 'empty', '');
rejects(validateVenezuelanMobile, 'obvious filler', '00000000000');

// Normalisation must produce the local form Mercantil matches on, NOT E.164.
// Sending +58... silently matches no account.
ok('normalises E.164 to local form',
  normalizeVenezuelanMobile('+584121234567') === '04121234567');
ok('normalises 00 prefix to local form',
  normalizeVenezuelanMobile('00584121234567') === '04121234567');
ok('normalises bare 10-digit to local form',
  normalizeVenezuelanMobile('4121234567') === '04121234567');
ok('leaves local form untouched',
  normalizeVenezuelanMobile('04121234567') === '04121234567');

console.log('\nCEDULA');

accepts(validateCedula, 'plain', '12345678');
accepts(validateCedula, 'V- prefix', 'V-12345678');
accepts(validateCedula, 'with dots', '12.345.678');
accepts(validateCedula, 'minimum length', '123456');

rejects(validateCedula, 'single digit', '1');
rejects(validateCedula, 'too short', '12345');
rejects(validateCedula, 'too long', '1234567890123');
rejects(validateCedula, 'letters', 'ABCDEFGH');
rejects(validateCedula, 'empty', '');

ok('strips V- prefix', normalizeCedula('V-12345678') === '12345678');
ok('strips dots', normalizeCedula('12.345.678') === '12345678');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
