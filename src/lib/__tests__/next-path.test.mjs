/**
 * Post-login redirect sanitising.
 *
 * The auth pages accept `?next=` so a customer signing in from the checkout is
 * returned to it. An unchecked value there is an open redirect, which is a real
 * phishing primitive: a link to OUR login page that bounces to an attacker's
 * copy, arriving with our domain in the history and the customer's trust
 * already spent.
 */

import assert from 'node:assert/strict';
import { safeNextPath } from '../next-path.ts';

let passed = 0;
let failed = 0;

function check(name, input, expected) {
  const actual = safeNextPath(input);
  try {
    assert.equal(actual, expected);
    passed++;
    console.log(`  ok   ${name}`);
  } catch {
    failed++;
    console.error(`  FAIL ${name}: ${JSON.stringify(input)} -> ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`);
  }
}

const FALLBACK = '/account';

console.log('\nALLOWED — same-site paths\n');
check('checkout', '/checkout', '/checkout');
check('account settings', '/account/settings', '/account/settings');
check('path with query', '/checkout?step=payment', '/checkout?step=payment');
check('root', '/', '/');

console.log('\nREFUSED — anything that could leave the site\n');
check('absolute http url', 'https://evil.example.com', FALLBACK);
check('protocol-relative url', '//evil.example.com', FALLBACK);
check('protocol-relative with path', '//evil.example.com/login', FALLBACK);
check('backslash trick', '/\\evil.example.com', FALLBACK);
check('javascript scheme', 'javascript:alert(1)', FALLBACK);
check('data scheme', 'data:text/html,<script>alert(1)</script>', FALLBACK);
check('bare host', 'evil.example.com', FALLBACK);
check('relative path without leading slash', 'checkout', FALLBACK);

console.log('\nREFUSED — empty and missing\n');
check('empty string', '', FALLBACK);
check('null', null, FALLBACK);
check('undefined', undefined, FALLBACK);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
