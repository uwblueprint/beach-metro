"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Primary sections. Settings and the user footer are rendered separately below.
const NAV_ITEMS = [
  { label: "Overview", href: "/overview" },
  { label: "Routes", href: "/routes" },
  { label: "Members", href: "/members" },
  { label: "Finances", href: "/finances" },
  // TEMP: API playground for backend exploration — delete with app/(dashboard)/playground.
  { label: "API Playground · temp", href: "/playground" },
] as const;

function NavLink({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block rounded-md px-3 py-2 text-sm",
        active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      {label}
    </Link>
  );
}

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r">
      {/* Brand (not a link) */}
      <div className="px-4 py-4 font-semibold">Dispatch</div>

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Settings + signed-in user */}
      <div className="flex flex-col gap-1 border-t p-2">
        <NavLink label="Settings" href="/settings" />
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-muted-foreground truncate text-sm" title={userEmail ?? undefined}>
            {userEmail ?? "Not signed in"}
          </span>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
