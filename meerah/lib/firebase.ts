/**
 * Google sign-in, client side.
 *
 * Firebase only proves who someone is. The ID token this produces is not
 * trusted on its own — the backend verifies it with Google before issuing a
 * Meerah session.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * 1. **The modules are preloaded, not imported inside the click handler.**
 *    Browsers only allow a popup opened synchronously from a user gesture.
 *    Awaiting a dynamic import first spends that gesture, and the popup is
 *    silently blocked — the promise never settles and the button sits on
 *    "Opening Google…" forever. Preloading on mount keeps the click itself
 *    synchronous.
 *
 * 2. **Redirect is the fallback, not the plan.** Popups still get blocked by
 *    strict settings, in-app browsers, and some Android configurations — which
 *    is a large share of this audience. When that happens we send the whole
 *    page to Google instead and pick the result up on return.
 */

import type { FirebaseApp } from 'firebase/app';
import type { Auth, UserCredential } from 'firebase/auth';

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(CONFIG.apiKey && CONFIG.authDomain && CONFIG.projectId);
}

type AuthModule = typeof import('firebase/auth');

let ready: Promise<{ auth: Auth; mod: AuthModule }> | null = null;

/** Loads Firebase once. Call on mount so the click handler never awaits. */
export function preloadFirebase(): Promise<{ auth: Auth; mod: AuthModule }> {
  if (!isFirebaseConfigured()) return Promise.reject(new Error('Google sign-in is not set up yet.'));

  ready ??= (async () => {
    const [{ initializeApp, getApps }, mod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const app: FirebaseApp = getApps()[0] ?? initializeApp(CONFIG);
    return { auth: mod.getAuth(app), mod };
  })();

  return ready;
}

function googleProvider(mod: AuthModule) {
  const provider = new mod.GoogleAuthProvider();
  // Always show the chooser: people share devices, and silently reusing the
  // last Google account would sign someone into a stranger's paid balance.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Opens the Google chooser and returns an ID token.
 *
 * Must be called from a click handler with Firebase already preloaded, or the
 * popup will be blocked.
 */
export async function signInWithGoogle(): Promise<string> {
  const { auth, mod } = await preloadFirebase();

  let credential: UserCredential;
  try {
    credential = await mod.signInWithPopup(auth, googleProvider(mod));
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    // Popup refused by the browser — hand the whole page to Google instead.
    // This never resolves: the page navigates away and resumes on return.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await mod.signInWithRedirect(auth, googleProvider(mod));
      return new Promise<string>(() => {});
    }
    throw error;
  }

  return credential.user.getIdToken();
}

/**
 * Picks up a redirect sign-in on page load.
 *
 * Returns null when the page was not reached by returning from Google, which is
 * the normal case.
 */
export async function completeRedirectSignIn(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const { auth, mod } = await preloadFirebase();
    const result = await mod.getRedirectResult(auth);
    return result ? result.user.getIdToken() : null;
  } catch {
    return null;
  }
}

/** Turns Firebase's error codes into something worth reading. */
export function describeGoogleError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return '';
  }
  if (code === 'auth/network-request-failed') {
    return 'Could not reach Google. Check your connection and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This site is not allowed to sign you in yet. Please tell us — this one is ours to fix.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is switched off for this app. Please tell us — this one is ours to fix.';
  }
  return (error as Error)?.message || 'Google sign-in did not work. Please try again.';
}
