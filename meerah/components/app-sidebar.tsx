'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bookmark, CalendarDays, Clapperboard, ImageIcon, LineChart, Mic,
  Music, Scissors, Sparkles, Tag, UserRound, Video, Wand2,
} from 'lucide-react';
import { GROUPS, toolsInGroup, type ToolGroup } from '@/lib/tools';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from '@/components/ui/sidebar';
import type { User } from '@/lib/api';

/**
 * The product's navigation, as a sidebar.
 *
 * It replaces a header mega-dropdown that had to be hovered to reveal what the
 * twelve tools were. A sidebar shows all of them at once, and collapsing it to
 * icons gives that back when the work needs the width — which on a studio page
 * it does, because a 370px settings rail is already sitting beside it.
 *
 * The block ships with sample teams and a projects list. Neither exists here:
 * there is one product and no teams, so the header is the wordmark and the
 * groups are the five the tool catalogue already defines.
 */

/** One icon per tool. The sidebar collapses to icons, so these carry the whole
 *  meaning at 48px — a generic dot for every row would make the collapsed state
 *  useless. */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  videngine: Video, vibereel: Sparkles, shotdirect: Clapperboard, snipreel: Scissors,
  pixcraft: ImageIcon, patchup: Wand2,
  talksync: UserRound, bodydouble: UserRound, starmaker: UserRound, myvoice: Mic,
  salesreel: Tag, soundtrack: Music,
};

const PLACES = [
  { href: '/studio',   label: 'Quick make',   icon: Sparkles },
  { href: '/saved',    label: 'Saved',        icon: Bookmark },
  { href: '/calendar', label: 'Post Planner', icon: CalendarDays },
  { href: '/pricing',  label: 'Prices',       icon: Tag },
];

export function AppSidebar({
  user, onSignOut, nairaPerCredit, ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: User | null;
  onSignOut?: () => void;
  nairaPerCredit?: number;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/create/videngine">
                <div className="flex aspect-square size-8 items-center justify-center rounded bg-gradient-to-br from-[var(--indigo)] to-[var(--lilac)]" />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold text-foreground">Meerah</span>
                  <span className="truncate text-xs">Pay in Naira</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group: ToolGroup) => {
          const tools = toolsInGroup(group);
          if (tools.length === 0) return null;
          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarMenu>
                {tools.map((tool) => {
                  const Icon = ICONS[tool.id] ?? Sparkles;
                  const active = pathname === `/create/${tool.id}`;
                  return (
                    <SidebarMenuItem key={tool.id}>
                      <SidebarMenuButton asChild isActive={active} tooltip={tool.blurb}>
                        <Link href={`/create/${tool.id}`}>
                          <Icon />
                          <span>{tool.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}

        <SidebarGroup>
          <SidebarGroupLabel>Your account</SidebarGroupLabel>
          <SidebarMenu>
            {PLACES.map((place) => (
              <SidebarMenuItem key={place.href}>
                <SidebarMenuButton asChild isActive={pathname === place.href} tooltip={place.label}>
                  <Link href={place.href}>
                    <place.icon />
                    <span>{place.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {/* Owner-only, and only rendered when the server says so — the flag
                comes from `/auth/me`, which reads the same ADMIN_EMAILS the
                guard does, so the menu and the data cannot disagree. */}
            {user?.isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin'} tooltip="Owner metrics">
                  <Link href="/admin"><LineChart /><span>Owner metrics</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} onSignOut={onSignOut} nairaPerCredit={nairaPerCredit} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
