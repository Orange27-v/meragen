'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken, getToken } from '@/lib/api';
import {
  signInWithGoogle, describeGoogleError, isFirebaseConfigured,
  preloadFirebase, completeRedirectSignIn,
} from '@/lib/firebase';

/**
 * The only way in.
 *
 * Signing in and signing up are the same action — Google does not distinguish
 * between a new and a returning person, and neither should we.
 */
export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = isFirebaseConfigured();

  // Already signed in? Go straight through.
  useEffect(() => {
    if (getToken()) { router.replace('/studio'); return; }

    // Load Firebase now, so the click that opens the popup stays synchronous.
    // Awaiting the import inside the handler spends the user gesture and the
    // browser blocks the popup.
    void preloadFirebase().catch(() => undefined);

    // If we were sent to Google as a full-page redirect, finish that here.
    void completeRedirectSignIn().then(async (idToken) => {
      if (!idToken) return;
      setBusy(true);
      try {
        const result = await api.google(idToken);
        setToken(result.token);
        router.push('/studio');
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
    });
  }, [router]);

  async function go() {
    setError('');
    setBusy(true);
    try {
      const idToken = await signInWithGoogle();
      const result = await api.google(idToken);
      setToken(result.token);
      router.push('/studio');
    } catch (err) {
      // Closing the pop-up is a decision, not a failure — say nothing.
      const message = describeGoogleError(err);
      if (message) setError(message);
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link className="wordmark" href="/"><span className="mark" />Meerah</Link>

        <h1 className="display" style={{ fontSize: '2rem', margin: '1.75rem 0 .5rem' }}>
          Sign in to start
        </h1>
        <p className="muted" style={{ marginBottom: '1.75rem', fontSize: '.95rem' }}>
          One tap. No password to remember, and nothing to pay until you generate something.
        </p>

        <div className="card">
          {error && <div className="alert">{error}</div>}

          {configured ? (
            <button type="button" className="btn btn-primary btn-block" onClick={go} disabled={busy}
>
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="currentColor" d="M45.1 24.5c0-1.6-.1-2.7-.4-4H24v7.3h12.1c-.2 1.9-1.6 4.9-4.5 6.9l6.9 5.4c4.1-3.8 6.6-9.4 6.6-15.6z" opacity=".95" />
                <path fill="currentColor" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.5 46 24 46z" opacity=".8" />
                <path fill="currentColor" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 9.9l7.1-5.5z" opacity=".65" />
                <path fill="currentColor" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.3 29.9 2 24 2 15.5 2 8.1 6.9 4.4 14.1l7.1 5.5c1.8-5.3 6.7-9.1 12.5-9.1z" />
              </svg>
              {busy ? 'Opening Google…' : 'Continue with Google'}
            </button>
          ) : (
            <p className="muted" style={{ fontSize: '.9rem' }}>
              Sign-in is not available right now. Please try again shortly.
            </p>
          )}
        </div>

        <p className="muted" style={{ marginTop: '1.25rem', fontSize: '.85rem', textAlign: 'center' }}>
          We only ever see your name and email address.
        </p>
      </div>
    </main>
  );
}
