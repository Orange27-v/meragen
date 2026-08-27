/**
 * Google sign-in, client side.
 *
 * Firebase is loaded lazily and only when it is configured, so a build with no
 * Firebase keys ships none of this code and the button never appears.
 *
 * The ID token this produces is not trusted by itself — the server verifies it
 * with Google before issuing a Meerah session.
 */

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(CONFIG.apiKey && CONFIG.authDomain && CONFIG.projectId);
}

/** Opens the Google chooser and returns the ID token to hand to our API. */
export async function signInWithGoogle(): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error('Google sign-in is not set up yet.');
  }

  const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);

  const app = getApps()[0] ?? initializeApp(CONFIG);
  const provider = new GoogleAuthProvider();
  // Always show the chooser: people share devices, and silently reusing the
  // last Google account signs someone into a stranger's paid balance.
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(getAuth(app), provider);
  return credential.user.getIdToken();
}

/** Turns Firebase's error codes into something worth reading. */
export function describeGoogleError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return '';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Could not reach Google. Check your connection and try again.';
  }
  return (error as Error)?.message || 'Google sign-in did not work. Please try again.';
}
