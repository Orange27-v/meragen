/**
 * Proves the service worker never caches API traffic.
 *
 * A cached credit balance is worse than none, and a cached API response could
 * in principle be served to a different account on a shared device. This runs
 * sw.js against stub globals and asserts which requests it intercepts.
 *
 *   node scripts/check-sw.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const listeners = {};
const cachePuts = [];

const sandbox = {
  self: {
    location: { origin: 'https://meerah.com' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  },
  caches: {
    open: async (name) => ({
      put: async (request) => { cachePuts.push({ name, url: request.url }); },
      keys: async () => [],
      delete: async () => true,
      add: async () => {},
    }),
    match: async () => undefined,
    keys: async () => [],
    delete: async () => true,
  },
  fetch: async () => ({ ok: true, type: 'basic', clone: () => ({}) }),
  URL,
  Promise,
  console,
};
sandbox.self.caches = sandbox.caches;

vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), sandbox);

/** Returns true when the worker takes over the request. */
function intercepts(url) {
  let handled = false;
  listeners.fetch({
    request: { method: 'GET', url },
    respondWith: () => { handled = true; },
  });
  return handled;
}

const MUST_NOT_INTERCEPT = [
  'https://meerah.com/api/v1/auth/me',
  'https://meerah.com/api/v1/account/balance',
  'https://meerah.com/api/v1/predictions/abc/result',
  'https://meerah.com/api/v1/pricing',
  'https://meerah.com/webhooks/paystack',
];

const SHOULD_INTERCEPT = [
  'https://meerah.com/studio',
  'https://meerah.com/files/generations/out.mp4',
  'https://meerah.com/_next/static/chunks/main.js',
];

let failed = false;

for (const url of MUST_NOT_INTERCEPT) {
  const bad = intercepts(url);
  console.log(`  ${bad ? 'FAIL' : 'ok  '}  never cached: ${url}`);
  if (bad) failed = true;
}

for (const url of SHOULD_INTERCEPT) {
  const ok = intercepts(url);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  served offline: ${url}`);
  if (!ok) failed = true;
}

// A POST must always go straight to the network.
let postHandled = false;
listeners.fetch({ request: { method: 'POST', url: 'https://meerah.com/api/v1/generate' }, respondWith: () => { postHandled = true; } });
console.log(`  ${postHandled ? 'FAIL' : 'ok  '}  never cached: POST /api/v1/generate`);
if (postHandled) failed = true;

console.log(failed ? '\nservice worker check FAILED' : '\nservice worker check passed');
process.exit(failed ? 1 : 0);
