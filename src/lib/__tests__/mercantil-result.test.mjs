/**
 * Approval-detection tests for the Mercantil gateway.
 *
 *   node --experimental-strip-types src/lib/__tests__/mercantil-result.test.mjs
 *
 * The case that matters is `guId present, nothing else` — the shape that let a
 * Pago Movil with a made-up cedula and phone number be accepted as paid. It is
 * pinned here so a future "be more permissive so fewer payments get declined"
 * change has to delete an explicitly-named test rather than quietly widen a
 * boolean.
 *
 * Everything here is a pure function over a JSON payload; no network, no bank.
 */

import assert from 'node:assert/strict';
import { isPaymentSuccessful } from '../mercantil-result.ts';

let passed = 0;
let failed = 0;

function check(name, payload, expected) {
  const actual = isPaymentSuccessful(payload);
  try {
    assert.equal(actual, expected);
    passed++;
    console.log(`  ok   ${name}`);
  } catch {
    failed++;
    console.error(`  FAIL ${name}: expected ${expected}, got ${actual}`);
  }
}

console.log('\nMUST BE REJECTED');

// The regression. A gateway trace id is not an approval.
check('bare gateway guId, no transaction envelope', { infoMsg: { guId: 'abc-123' } }, false);
check('guId alongside an explicit C2P rejection', {
  infoMsg: { guId: 'abc-123' },
  transaction_c2p_response: { trx_status: 'rejected', trx_internal_status: '9999' },
}, false);
check('guId with an empty transaction envelope', {
  infoMsg: { guId: 'abc-123' },
  transaction_c2p_response: {},
}, false);

check('error_list populated', { error_list: [{ description: 'Cedula invalida' }] }, false);
check('status.errorCode set', { status: { errorCode: '81', descTech: 'invalid account' } }, false);
check('status.errorTech set', { status: { errorTech: 'TIMEOUT' } }, false);

// Loose arms the old implementation accepted, none anchored to an envelope.
check('bare code: 0', { code: 0 }, false);
check("bare response_code '00'", { response_code: '00' }, false);
check("bare status 'success' string", { status: 'success' }, false);
check("bare codigo '00'", { codigo: '00' }, false);

check('empty object', {}, false);
check('null', null, false);
check('undefined', undefined, false);
check('a string', 'approved', false);
check('rejection wins over a positive internal status', {
  transaction_response: { trx_status: 'denied', trx_internal_status: '0000' },
}, false);
check('unknown status word', {
  transaction_response: { trx_status: 'pending' },
}, false);

console.log('\nMUST BE ACCEPTED');

check('card approved', {
  transaction_response: { trx_status: 'approved', payment_reference: '9931' },
}, true);
check('C2P approved under its own envelope', {
  infoMsg: { guId: 'abc-123' },
  transaction_c2p_response: { trx_status: 'approved' },
}, true);
check("internal status '0000' with no contradicting status", {
  transaction_response: { trx_internal_status: '0000' },
}, true);
check('approved with odd casing and whitespace', {
  transaction_response: { trx_status: '  Approved ' },
}, true);
check('generic transaction envelope', {
  transaction: { status: 'approved' },
}, true);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
