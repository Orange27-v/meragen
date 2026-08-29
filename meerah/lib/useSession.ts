'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, clearToken, ApiError, type User } from '@/lib/api';

/**
 * The signed-in session, in one place.
 *
 * Every page used to repeat this: read the token, bounce to /signin when it is
 * missing, fetch the user, and bounce again on a 401. Five copies meant five
 * chances to drift, and the credit balance each page showed was whatever it had
 * happened to fetch. Now the shell owns it and pages read it.
 */
export interface Session {
  /** The raw session token. Null until the first read completes. */
  token: string | null;
  user: User | null;
  /** True until we know whether there is a session at all. */
  loading: boolean;
  /** Re-reads the user. Call after anything that moves the balance. */
  refresh: () => Promise<void>;
  signOut: () => void;
}

export function useSession(): Session {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const leave = useCallback(() => {
    clearToken();
    router.replace('/signin');
  }, [router]);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch (err) {
      // Only an expired or revoked session sends someone to the sign-in page.
      // A network blip must not throw away a token that is still good.
      if (err instanceof ApiError && err.status === 401) leave();
    }
  }, [leave]);

  useEffect(() => {
    const stored = getToken();
    if (!stored) { leave(); return; }
    setToken(stored);
    void refresh().finally(() => setLoading(false));
  }, [leave, refresh]);

  return { token, user, loading, refresh, signOut: leave };
}
