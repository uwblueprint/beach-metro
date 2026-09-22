"use client";

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Clipboard,
  LayoutGrid,
  MapPin,
  Send,
  Settings,
  Sidebar as SidebarIcon,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ListItem } from "@/components/ui/list-item";
import { cn } from "@/lib/utils";

/** Gap from screen edge ↔ sidebar content, and sidebar content ↔ page (matches page-container pl-4). */
const SIDEBAR_GUTTER = 16;
/** Nav / brand content width when expanded. */
const SIDEBAR_CONTENT_WIDTH = 184;
/** Total aside width when expanded (gutter + content). */
const SIDEBAR_WIDTH_EXPANDED = SIDEBAR_GUTTER + SIDEBAR_CONTENT_WIDTH;
/** Icon rail = list-item md hit target (p-2 + icon + p-2). */
const SIDEBAR_ICON_RAIL = 40;
const SIDEBAR_WIDTH_COLLAPSED = SIDEBAR_GUTTER + SIDEBAR_ICON_RAIL;

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/overview", icon: LayoutGrid },
  { label: "Routes", href: "/routes", icon: MapPin },
  { label: "Members", href: "/members", icon: Users },
  { label: "Finances", href: "/finances", icon: Briefcase },
  { label: "Labels", href: "/labels", icon: Clipboard },
];

function displayName(email: string | null) {
  if (!email) return "Not signed in";
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const width = `${collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED}px`;
    document.documentElement.style.setProperty("--sidebar-width", width);
    return () => {
      document.documentElement.style.setProperty("--sidebar-width", `${SIDEBAR_WIDTH_EXPANDED}px`);
    };
  }, [collapsed]);

  return (
    <aside
      data-collapsed={collapsed ? "true" : undefined}
      className="t-sidebar t-resize relative z-10 flex h-screen shrink-0 flex-col overflow-visible bg-transparent pt-[24px] pb-4 pl-4"
      style={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
      }}
    >
      {/* Content column — shrinks with collapse (aside does not clip) */}
      <div
        className="t-sidebar-inner flex h-full min-h-0 flex-col"
        style={{ width: collapsed ? SIDEBAR_ICON_RAIL : SIDEBAR_CONTENT_WIDTH }}
      >
        {/* Brand — same px/gap as list-item md so the Send icon shares the nav icon origin */}
        <div
          className={cn(
            "group/brand t-sidebar-brand bg-bg relative mb-5 flex h-10 shrink-0 items-center overflow-hidden rounded-2xl pr-2 pl-3 text-secondary",
            "smooth-shadow-ring-xs",
            "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[var(--stroke-inner)] before:content-['']",
            "hover:scale-[0.97] motion-reduce:hover:scale-100",
          )}
          style={{
            width: collapsed ? SIDEBAR_ICON_RAIL : SIDEBAR_CONTENT_WIDTH,
          }}
        >
          <Link
            href="/overview"
            className={cn(
              "relative z-[1] flex min-w-0 flex-1 items-center gap-[10px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              collapsed && "pointer-events-none",
            )}
            tabIndex={collapsed ? -1 : undefined}
            aria-hidden={collapsed || undefined}
          >
            <Send
              aria-hidden
              className={cn("size-4 shrink-0", collapsed && "opacity-0")}
              strokeWidth={1.75}
            />
            <span className="sidebar-label text-md">Dispatch</span>
          </Link>

          {/* Expand — centered in the square tile when collapsed */}
          <Button
            type="button"
            variant="default"
            size="icon"
            aria-label="Expand sidebar"
            aria-expanded={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            className={cn(
              "absolute top-1/2 left-1/2 z-10 size-8 -translate-x-1/2 -translate-y-1/2 text-secondary",
              "transition-opacity duration-150 ease-out",
              collapsed ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            )}
            onClick={() => setCollapsed(false)}
          >
            <SidebarIcon aria-hidden strokeWidth={1.75} />
          </Button>

          {/* Collapse — right side, hover-reveal when expanded (4px inset = equal to tile pad) */}
          <Button
            type="button"
            variant="default"
            size="icon"
            aria-label="Collapse sidebar"
            aria-expanded={!collapsed}
            tabIndex={collapsed ? -1 : 0}
            className={cn(
              "absolute top-1/2 right-1 z-10 size-8 -translate-y-1/2 text-secondary",
              "transition-opacity duration-150 ease-out",
              collapsed
                ? "pointer-events-none opacity-0"
                : [
                    "pointer-events-none opacity-0",
                    "group-hover/brand:pointer-events-auto group-hover/brand:opacity-100",
                    "group-focus-within/brand:pointer-events-auto group-focus-within/brand:opacity-100",
                  ],
            )}
            onClick={() => setCollapsed(true)}
          >
            <SidebarIcon aria-hidden strokeWidth={1.75} />
          </Button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <ListItem
                key={href}
                href={href}
                size="md"
                type="leading-icon"
                surface="sidebar"
                active={active}
                icon={<Icon aria-hidden strokeWidth={1.75} />}
                title={label}
              >
                {label}
              </ListItem>
            );
          })}
        </nav>

        <div className="mt-auto flex shrink-0 flex-col gap-4">
          <ListItem
            href="/settings"
            size="md"
            type="leading-icon"
            surface="sidebar"
            active={pathname === "/settings" || pathname.startsWith("/settings/")}
            icon={<Settings aria-hidden strokeWidth={1.75} />}
            title="Settings"
            className="text-muted-foreground data-[active=true]:text-primary"
          >
            Settings
          </ListItem>

          <div className="bg-hairline h-px w-full" role="separator" />

          <form action="/auth/signout" method="post">
            <ListItem
              nativeType="submit"
              type="leading-icon"
              size="md"
              surface="sidebar"
              icon={<User aria-hidden strokeWidth={1.75} />}
              title={userEmail ? `Sign out (${userEmail})` : "Sign out"}
            >
              {displayName(userEmail)}
            </ListItem>
          </form>
        </div>
      </div>
    </aside>
  );
}
