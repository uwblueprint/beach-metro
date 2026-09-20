"use client";

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Clipboard,
  LayoutGrid,
  MapPin,
  Send,
  Settings,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ListItem } from "@/components/ui/list-item";
import { cn } from "@/lib/utils";

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

  return (
    <aside className="relative z-10 flex h-screen w-[200px] shrink-0 flex-col bg-transparent pl-4 pt-5 pb-4">
      {/* Brand notch */}
      <Link
        href="/overview"
        className={cn(
          "bg-bg relative mb-5 flex shrink-0 items-center gap-2 rounded-2xl px-2.5 py-3",
          "smooth-shadow-ring-xs",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[var(--stroke-inner)] before:content-['']",
          "cursor-pointer outline-none select-none",
          "transition-transform duration-150 ease-out hover:scale-[0.97]",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          "motion-reduce:transition-none motion-reduce:hover:scale-100",
        )}
      >
        <Send aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="text-md text-primary">Dispatch</span>
      </Link>

      {/* Primary nav — grows so footer stays at the bottom */}
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
            >
              {label}
            </ListItem>
          );
        })}
      </nav>

      {/* Footer: Settings → hairline → user (Figma gap 16px) */}
      <div className="mt-auto flex shrink-0 flex-col gap-4">
        <ListItem
          href="/settings"
          size="md"
          type="leading-icon"
          surface="sidebar"
          active={pathname === "/settings" || pathname.startsWith("/settings/")}
          icon={<Settings aria-hidden strokeWidth={1.75} />}
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
    </aside>
  );
}
