'use client';

import { ChevronsUpDown, CreditCard, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import type { User } from '@/lib/api';

/**
 * The account, at the foot of the sidebar.
 *
 * The balance sits in the trigger rather than behind the menu: it is the number
 * a customer checks most often, and burying it behind a click is how people end
 * up pressing Generate without knowing whether they can afford it.
 *
 * The block ships this with an avatar image, upgrade and notification rows.
 * None of those exist here — there are no plans to upgrade to, and the only
 * thing an account does is hold credits.
 */
export function NavUser({
  user, onSignOut, nairaPerCredit,
}: {
  user?: User | null;
  onSignOut?: () => void;
  /** Derived from the live price list by the shell. Never a number typed here:
   *  a published rate that disagrees with what someone is charged is worse
   *  than showing no rate at all. */
  nairaPerCredit?: number;
}) {
  const { isMobile } = useSidebar();
  const initial = user?.email?.[0]?.toUpperCase() ?? '?';
  const credits = user?.creditBalance ?? 0;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="h-8 w-8 rounded">
                <AvatarFallback className="rounded bg-secondary text-foreground">{initial}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-xs">{user?.email ?? 'Signed in'}</span>
                <span className="truncate text-xs font-semibold tabular-nums text-foreground">
                  {credits.toLocaleString()} credits
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="grid gap-1 text-left">
                <span className="truncate text-sm">{user?.email}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {credits.toLocaleString()} credits
                  {nairaPerCredit
                    ? ` · ₦${Math.round(credits * nairaPerCredit).toLocaleString()}`
                    : ''}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => window.dispatchEvent(new CustomEvent('meerah:buy-credits'))}
              >
                <CreditCard />
                Buy credits
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSignOut?.()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
