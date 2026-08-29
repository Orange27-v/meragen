/**
 * Meerah service worker.
 *
 * Built for a phone on patchy Nigerian mobile data, not for offline use. The
 * job is to make a dropped connection survivable, not to pretend the app works
 * without one.
 *
 * Rules, in order of importance:
 *
 *   1. NEVER cache API responses. They carry credit balances, generation
 *      results and session-scoped data — a stale balance is worse than no
 *      balance, and a cached response could be served to the wrong account.
 *   2. Cache the app shell so a reconnect does not re-download the interface.
 *   3. Cache generated media on demand, so re-watching something already
 *      downloaded costs nothing.
 */

// Bump SHELL_CACHE on any change to this file. Old caches are deleted on
// activate, which is what evicts build chunks from a previous deploy.
const SHELL_CACHE = 'meerah-shell-v2';
const MEDIA_CACHE = 'meerah-media-v1';

/** Media kept offline, so a customer's own work re-opens without re-downloading. */
const MEDIA_LIMIT = 30;

const SHELL_ASSETS = ['/', '/studio', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Best effort: a missing asset must not stop the worker installing.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== SHELL_CACHE && key !== MEDIA_CACHE)
            .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** Oldest-out, so the cache cannot grow without bound on a small phone. */
async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. API and auth: always live. Never cached, never served stale.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhooks/')) return;

  // 2. Generated media and uploads: cache after first fetch.
  if (url.pathname.startsWith('/files/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(MEDIA_CACHE)
            .then((cache) => cache.put(request, copy))
            .then(() => trimCache(MEDIA_CACHE, MEDIA_LIMIT));
        }
        return response;
      })),
    );
    return;
  }

  // 3. Build output: hashed by content, so a stale copy is a *different* file
  //    rather than an old version of the same one. Serving one is how a page
  //    ends up running half of yesterday's bundle, so these are never given a
  //    fallback — a failed chunk must fail, and the page reloads clean.
  const isBuildAsset = url.pathname.startsWith('/_next/static/');

  // 4. Everything else: network first, cache as a fallback for a dropped
  //    connection. Fresh when there is signal, still usable when there is not.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic' && !isBuildAsset) {
          const copy = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;

        // The shell is only ever a substitute for a *page*. Returning it for a
        // script or a stylesheet hands the browser HTML where it expects
        // JavaScript, which it reports as "a client-side exception" — the
        // failure looks like a bug in the app rather than a dropped
        // connection, and a hard refresh does not clear it.
        if (request.mode === 'navigate') {
          return (await caches.match('/studio')) ?? Response.error();
        }
        return Response.error();
      }),
  );
});
