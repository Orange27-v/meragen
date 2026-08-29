'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, type Tier, type User } from '@/lib/api';
import { toolById } from '@/lib/tools';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import TopUpSheet from '@/components/TopUpSheet';

/**
 * One shell for every signed-in page.
 *
 * Before this there were five: a bespoke header inside the studio and the same
 * `.topbar` block copy-pasted into four pages, each with a different set of
 * links. The result was a product where `/create` was reachable from exactly
 * one place, `/admin` from nowhere, and Sign out from a single page. Nothing
 * felt like one application because, structurally, it was not one.
 *
 * Navigation is a sidebar rather than a header dropdown. Twelve tools behind a
 * hover menu meant you had to already know what you were looking for; a sidebar
 * shows all of them. It collapses to icons, which matters here more than in most
 * products: a studio page already gives 370px to a settings rail, so the nav has
 * to be able to get out of the way.
 *
 * On a studio the sidebar starts collapsed and on every other page it starts
 * open — the width is worth more to the work than to the navigation.
 *
 * Two densities, one shell:
 *
 *   · `app`  — the studio. Fixed height, no page scroll, so a tool can dock its
 *              own panels to the edges of the viewport.
 *   · `page` — everything else. A normal scrolling column.
 */
export default function DashboardShell({
  density = 'page', user, onSignOut, activeTool, onShowGuide, refreshUser, children,
}: {
  density?: 'app' | 'page';
  user: User | null;
  onSignOut: () => void;
  /** Set on /create so the sidebar can mark the current tool and the header can
   *  name it. The sidebar navigates with links, so there is nothing to call. */
  activeTool?: string;
  /** Set on a tool page, so the header can offer its guide. */
  onShowGuide?: () => void;
  /** Called after a top-up lands, so the balance in the header catches up. */
  refreshUser?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Prices are public and small, and the header, the nav menu and the cost
  // meter all read the same copy — one fetch for the whole dashboard.
  useEffect(() => {
    void api.pricing().then(({ tiers: found }) => setTiers(found)).catch(() => { /* nav degrades quietly */ });
  }, []);

  // Coming back from Paystack. Do not wait for the webhook: it needs a public
  // URL to reach us, which does not exist in development and can be delayed in
  // production. Ask the server to verify this exact payment instead.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') ?? params.get('trxref');
    if (!reference) {
      if (params.get('paid') === '1') {
        setNotice('Payment received. Your credits will appear in a moment.');
        const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => refreshUser?.(), ms));
        return () => timers.forEach(clearTimeout);
      }
      return;
    }

    setNotice('Confirming your payment…');
    void api.verifyTopup(reference)
      .then((result) => {
        setNotice(result.credited
          ? 'Payment confirmed. Your credits are ready.'
          : 'Payment received. Your credits are already on your account.');
        refreshUser?.();
        // Clear the reference so a refresh does not re-run this.
        window.history.replaceState({}, '', pathname);
      })
      .catch(() => {
        setNotice('');
        setError('We could not confirm that payment yet. Refresh in a moment, or contact us if the credits do not appear.');
      });
  }, [pathname, refreshUser]);

  // A tool inside the studio cannot reach this sheet directly — it is a forked
  // component that knows nothing about the shell — so it says it needs credits
  // and the shell decides how to ask for them.
  useEffect(() => {
    const onNeedCredits = () => setBuying(true);
    window.addEventListener('meerah:buy-credits', onNeedCredits);
    return () => window.removeEventListener('meerah:buy-credits', onNeedCredits);
  }, []);

  const isApp = density === 'app';
  const tool = activeTool ? toolById(activeTool) : undefined;
  // One credit's worth of Naira, taken from the live price list rather than
  // written down — a published rate that disagrees with the charge is worse
  // than no rate.
  const cheapest = tiers[0];
  const nairaPerCredit = cheapest ? cheapest.naira / cheapest.credits : undefined;

  return (
    <SidebarProvider defaultOpen={!isApp}>
      <AppSidebar user={user} onSignOut={onSignOut} nairaPerCredit={nairaPerCredit} />

      <SidebarInset className={isApp ? 'h-dvh overflow-hidden' : undefined}>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          <div className="min-w-0">
            <span className="truncate text-sm font-medium text-foreground">
              {tool?.label ?? 'Meerah'}
            </span>
            {tool && (
              <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:inline">
                {tool.blurb}
              </span>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {onShowGuide && (
              <Button variant="ghost" size="sm" onClick={onShowGuide} className="hidden sm:inline-flex">
                How it works
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setBuying(true)}
              className="tabular-nums" title="Buy credits">
              <span className="hidden text-muted-foreground sm:inline">Credits</span>
              <b>{user?.creditBalance.toLocaleString() ?? '—'}</b>
            </Button>
          </div>
        </header>

        {(notice || error) && (
          <div className="shrink-0 px-4 pt-3">
            {notice && <div className="alert alert-ok">{notice}</div>}
            {error && <div className="alert">{error}</div>}
          </div>
        )}

        {isApp ? (
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        ) : (
          <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8">{children}</main>
        )}
      </SidebarInset>

      <TopUpSheet open={buying} onClose={() => setBuying(false)} returnTo={pathname} />
    </SidebarProvider>
  );
}
