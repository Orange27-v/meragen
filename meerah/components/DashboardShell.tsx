'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogOut,
  CreditCard,
  Bookmark,
  ChevronDown,
  Plus,
  HelpCircle,
  BarChart3,
  Menu,
  X,
} from 'lucide-react';
import { api, type Tier, type User } from '@/lib/api';
import { GROUPS, TOOLS, type ToolGroup } from '@/lib/tools';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import TopUpSheet from '@/components/TopUpSheet';

/**
 * The frame every signed-in page sits in.
 *
 * ── The navigation ────────────────────────────────────────────────────────
 * This used to be twelve links in a horizontally-scrolling strip at 12px, all
 * one weight, with no grouping. Two things were wrong with it beyond the look:
 *
 *   · It was a second, hand-written copy of the tool list. It had drifted —
 * it called ShotDirector "Cinema Studio", and it had lost VidEngine, Snip
 *     Reel, Body Double and MyVoice entirely. Four of the twelve tools you can
 * pay for could not be reached from the navigation at all.
 *
 *   · Twelve peers is not an information architecture. Making something and
 * going somewhere are different acts, and they were rendered identically.
 *
 * So the tools now come from `lib/tools.ts` — the registry that already knows
 * their names, their groups and what each one makes — and they live behind one
 *"Create" menu, grouped the way the registry groups them. What stays on the
 * bar is the three places you go rather than make: Library, Planner, Pricing.
 * Every href is unchanged.
 */

/** The places you go rather than make. Three is few enough to stay on the bar. */
const DESTINATIONS: Array<{ href: string; label: string }> = [
  { href: '/saved', label: 'Library' },
  { href: '/calendar', label: 'Planner' },
  { href: '/pricing', label: 'Pricing' },
];

/** `/studio` is the general video workspace; it is not one of the twelve tools. */
const STUDIO = { href: '/studio', label: 'Studio' };

export default function DashboardShell({
  density = 'page',
  user,
  onSignOut,
  activeTool,
  onShowGuide,
  refreshUser,
  children,
}: {
  density?: 'app' | 'page';
  user: User | null;
  onSignOut: () => void;
  activeTool?: string;
  onShowGuide?: () => void;
  refreshUser?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    void api
      .pricing()
      .then(({ tiers: found }) => setTiers(found))
      .catch(() => {});
  }, []);

  // Paystack redirect verification
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
    void api
      .verifyTopup(reference)
      .then((result) => {
        setNotice(
          result.credited
            ? 'Payment confirmed. Your credits are ready.'
            : 'Payment received. Your credits are already on your account.',
        );
        refreshUser?.();
        window.history.replaceState({}, '', pathname);
      })
      .catch(() => {
        setNotice('');
        setError(
          'We could not confirm that payment yet. Refresh in a moment, or contact us if the credits do not appear.',
        );
      });
  }, [pathname, refreshUser]);

  useEffect(() => {
    const onNeedCredits = () => setBuying(true);
    window.addEventListener('meerah:buy-credits', onNeedCredits);
    return () => window.removeEventListener('meerah:buy-credits', onNeedCredits);
  }, []);

  // A route change closes the mobile sheet; otherwise it stays open over the
  // page you just navigated to.
  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  const isApp = density === 'app';
  const cheapest = tiers[0];
  const nairaPerCredit = cheapest ? cheapest.naira / cheapest.credits : undefined;
  const initial = user?.email?.[0]?.toUpperCase() ?? 'M';
  const balance = user?.creditBalance ?? 0;

  /** Under a hundred credits is roughly one video away from empty. */
  const lowBalance = user !== null && balance < 100;

  const inCreate = pathname.startsWith('/create') || pathname.startsWith('/studio');
  const currentTool = useMemo(
    () => TOOLS.find((t) => t.id === activeTool || pathname === `/create/${t.id}`),
    [activeTool, pathname],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-nova-bg text-nova-text">
      {/* ====================================================================
          TOP BAR — 56px, one row, no horizontal scroll at any width.
          Left: brand, Create menu, destinations. Right: help, balance, account.
          ==================================================================== */}
      <header
        className="sticky top-0 z-50 flex h-nav shrink-0 items-center gap-2 border-b border-nova-border
                   bg-nova-bg px-4 sm:px-5"
      >
        {/* Brand */}
        <Link
          href="/studio"
          className="flex shrink-0 items-center gap-2 pr-1"
          aria-label="Meerah home"
        >
          <span className="flex size-7 items-center justify-center rounded-nova-sm bg-nova-accent text-nova-accentInk">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="currentColor">
              <path d="M8 1.2 9.9 6.1 14.8 8 9.9 9.9 8 14.8 6.1 9.9 1.2 8 6.1 6.1 8 1.2Z" />
            </svg>
          </span>
          <span className="hidden text-[16px] font-semibold tracking-[-0.02em] text-nova-text sm:inline">
            Meerah
          </span>
        </Link>

        {/* --- Desktop navigation ----------------------------------------
            `lg`, not `md`: the bar plus the shrink-0 right-hand cluster needs
            ~846px, so at 768 the two collided and pushed the account button
              off-screen. It also lines the nav up with the studios themselves,
                which stack below `lg`. */}
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          <CreateMenu active={inCreate} currentLabel={currentTool?.label} />
          {DESTINATIONS.map((item) => (
            <NavLink key={item.href} href={item.href} current={pathname === item.href}>
              {item.label}
            </NavLink>
          ))}
          {user?.isAdmin && (
            <NavLink href="/admin" current={pathname === '/admin'}>
              <BarChart3 className="size-3.5" aria-hidden />
              Metrics
            </NavLink>
          )}
        </nav>

        {/* --- Right-hand controls --------------------------------------- */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {onShowGuide && (
            <button
              type="button"
              onClick={onShowGuide}
              className="icon-btn hidden sm:inline-flex"
              aria-label="Guides and help"
            >
              <HelpCircle className="size-[18px]" aria-hidden />
            </button>
          )}

          {/* Balance. One control at the system height, split by a hairline
            rather than nesting a pill inside a pill. It turns amber below a
              hundred credits instead of staying the same green whether or not
                you can afford the next job. */}
          <div
            className={`flex h-10 items-stretch overflow-hidden rounded-full border
                        ${
                          lowBalance
                            ? 'border-warn/30 bg-warn-wash'
                            : 'border-nova-border bg-nova-card'
                        }`}
          >
            <span className="flex items-center gap-1.5 px-2.5">
              <span className="hidden text-[13px] text-nova-subtle sm:inline">Credits</span>
              <span
                className={`text-[14px] font-medium tabular-nums ${lowBalance ? 'text-warn' : 'text-nova-text'}`}
              >
                {balance.toLocaleString()}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setBuying(true)}
              className="flex items-center gap-1.5 border-l border-nova-border px-3.5 text-[14px] font-medium
                         text-nova-muted transition-colors hover:bg-nova-elevated hover:text-nova-text"
            >
              <Plus className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Top up</span>
            </button>
          </div>

          {/* Account */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex size-10 items-center justify-center rounded-full transition-colors
                           hover:bg-nova-card"
              >
                <Avatar className="size-8 ring-2 ring-nova-accent">
                  <AvatarFallback className="bg-nova-card text-[13px] font-semibold text-nova-accent">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-60 rounded-nova-card bg-nova-elevated p-2"
            >
              <DropdownMenuLabel className="px-2.5 py-2 font-normal">
                <span className="block truncate text-sm font-medium text-ink-primary">
                  {user?.email ?? 'Creator'}
                </span>
                <span className="mt-0.5 block text-xs tabular-nums text-ink-tertiary">
                  {balance.toLocaleString()} credits
                  {nairaPerCredit && user
                    ? ` · worth ₦${Math.round(balance * nairaPerCredit).toLocaleString()}`
                    : ''}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-edge-subtle" />

              <DropdownMenuGroup>
                <MenuRow icon={CreditCard} onSelect={() => setBuying(true)}>
                  Buy credits
                </MenuRow>
                <MenuRow icon={Bookmark} href="/saved">
                  Library
                </MenuRow>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="my-1 bg-edge-subtle" />
              <DropdownMenuItem
                onSelect={() => onSignOut?.()}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                           text-danger focus:bg-danger-wash focus:text-danger"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile navigation trigger */}
          <button
            type="button"
            onClick={() => setMobileNav((open) => !open)}
            className="icon-btn lg:hidden"
            aria-label={mobileNav ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNav}
          >
            {mobileNav ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </header>

      {/* --- Mobile navigation sheet ------------------------------------- */}
      {mobileNav && (
        <MobileNav
          pathname={pathname}
          isAdmin={user?.isAdmin ?? false}
          onClose={() => setMobileNav(false)}
          onShowGuide={onShowGuide}
        />
      )}

      {/* --- Payment notices --------------------------------------------- */}
      {(notice || error) && (
        <div className="mx-auto w-full max-w-page px-4 pt-3">
          {notice && <div className="alert alert-ok">{notice}</div>}
          {error && <div className="alert">{error}</div>}
        </div>
      )}

      {/* App mode gets a stated height, not `flex-1` — the studios inside are
          `h-full`, and a percentage height needs a definite parent to resolve
           against. See `.app-main` in globals.css. */}
      <main className={isApp ? 'app-main' : 'flex-1'}>{children}</main>

      <TopUpSheet open={buying} onClose={() => setBuying(false)} returnTo={pathname} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** A bar link. Current is marked by ink and fill, never by a coloured underline
 * that has to be positioned against the header's bottom edge. */
function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[15px] font-medium transition-colors
                  ${
                    current
                      ? 'text-nova-accent'
                      : 'text-nova-muted hover:bg-nova-card hover:text-nova-text'
                  }`}
    >
      {children}
    </Link>
  );
}

/**
 * Every tool, grouped the way `lib/tools.ts` groups them, each with the blurb
 * the registry already carries. A menu can afford to say what a tool makes;
 * a 12-item strip could not, which is why the strip needed you to already know.
 */
function CreateMenu({ active, currentLabel }: { active: boolean; currentLabel?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[15px] font-medium transition-colors
                      ${
                        active
                          ? 'text-nova-accent'
                          : 'text-nova-muted hover:bg-nova-card hover:text-nova-text'
                      }`}
        >
          Create
          {currentLabel && (
            <span className="max-w-[9rem] truncate text-nova-subtle">· {currentLabel}</span>
          )}
          <ChevronDown className="size-4 text-nova-subtle" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[min(34rem,calc(100vw-2rem))] rounded-nova-card bg-nova-elevated p-2"
      >
        <DropdownMenuItem asChild>
          <Link
            href={STUDIO.href}
            className="mb-1 flex cursor-pointer items-center gap-3 rounded-nova-md bg-nova-card
                       px-3 py-2.5 focus:bg-nova-hover"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-nova-accentWash text-nova-accent">
              <Plus className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-nova-text">Quick video</span>
              <span className="truncate text-[13px] text-nova-subtle">
                Describe a scene and pick any of 600+ models
              </span>
            </span>
          </Link>
        </DropdownMenuItem>

        <div className="grid gap-x-2 sm:grid-cols-2">
          {GROUPS.filter((group) => TOOLS.some((t) => t.group === group)).map((group) => (
            <div key={group} className="px-1 pt-2">
              <p className="section-title px-2 pb-1">{group}</p>
              {TOOLS.filter((tool) => tool.group === group).map((tool) => (
                <DropdownMenuItem key={tool.id} asChild>
                  <Link
                    href={`/create/${tool.id}`}
                    className="flex cursor-pointer flex-col !items-start gap-0.5 rounded-nova-md px-3
                               py-2 focus:bg-nova-card"
                  >
                    <span className="text-[15px] font-medium text-nova-text">{tool.label}</span>
                    <span className="line-clamp-1 text-[13px] text-nova-subtle">{tool.blurb}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A row in the account menu — the same shape whether it navigates or acts. */
function MenuRow({
  icon: Icon,
  href,
  onSelect,
  children,
}: {
  icon: typeof CreditCard;
  href?: string;
  onSelect?: () => void;
  children: ReactNode;
}) {
  const body = (
    <>
      <Icon className="size-4 text-nova-subtle" aria-hidden />
      {children}
    </>
  );
  const className =
    'flex w-full cursor-pointer items-center gap-3 rounded-nova-md px-3 py-2.5 text-[15px] ' +
    'text-nova-muted focus:bg-nova-card focus:text-nova-text';

  if (href) {
    return (
      <DropdownMenuItem asChild>
        <Link href={href} className={className}>
          {body}
        </Link>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem onSelect={onSelect} className={className}>
      {body}
    </DropdownMenuItem>
  );
}

/**
 * The same navigation on a phone, as a full sheet rather than a strip that
 * scrolls sideways. Tools stay grouped; nothing is hidden behind a swipe.
 */
function MobileNav({
  pathname,
  isAdmin,
  onClose,
  onShowGuide,
}: {
  pathname: string;
  isAdmin: boolean;
  onClose: () => void;
  onShowGuide?: () => void;
}) {
  return (
    <div className="fixed inset-0 top-nav z-40 overflow-y-auto bg-nova-bg lg:hidden">
      <nav className="px-4 pb-16 pt-4" aria-label="Main">
        <Link
          href={STUDIO.href}
          onClick={onClose}
          className="mb-5 flex items-center gap-3 rounded-nova-card bg-nova-card px-4 py-4"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-nova-accentWash text-nova-accent">
            <Plus className="size-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[16px] font-medium text-nova-text">Quick video</span>
            <span className="block text-[13px] text-nova-subtle">
              Describe a scene, pick a model
            </span>
          </span>
        </Link>

        {GROUPS.filter((group) => TOOLS.some((t) => t.group === group)).map((group: ToolGroup) => (
          <section key={group} className="mb-5">
            <p className="section-title mb-2">{group}</p>
            <div className="grid gap-1">
              {TOOLS.filter((tool) => tool.group === group).map((tool) => (
                <Link
                  key={tool.id}
                  href={`/create/${tool.id}`}
                  onClick={onClose}
                  aria-current={pathname === `/create/${tool.id}` ? 'page' : undefined}
                  className={`flex flex-col gap-0.5 rounded-nova-md px-4 py-3
                              ${pathname === `/create/${tool.id}` ? 'bg-nova-card' : ''}`}
                >
                  <span className="text-[16px] font-medium text-nova-text">{tool.label}</span>
                  <span className="text-[13px] text-nova-subtle">{tool.blurb}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section>
          <p className="section-title mb-2">Your account</p>
          <div className="grid gap-1">
            {DESTINATIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`rounded-nova-md px-4 py-3 text-[16px]
                            ${
                              pathname === item.href
                                ? 'bg-nova-card text-nova-accent'
                                : 'text-nova-muted'
                            }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={onClose}
                className="rounded-nova-md px-4 py-3 text-[16px] text-nova-muted"
              >
                Metrics
              </Link>
            )}
            {onShowGuide && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShowGuide();
                }}
                className="rounded-nova-md px-4 py-3 text-left text-[16px] text-nova-muted"
              >
                Guides and help
              </button>
            )}
          </div>
        </section>
      </nav>
    </div>
  );
}
