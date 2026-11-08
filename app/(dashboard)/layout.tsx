import { AppSidebar } from "@/components/app-sidebar";
import { LookToggle } from "@/components/dev-look-toggle";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { getClaims } from "@/lib/supabase/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const claims = await getClaims();
  const email = typeof claims?.email === "string" ? claims.email : null;

  return (
    <LookToggle>
      <div className="flex h-screen flex-1 overflow-hidden bg-bg-secondary">
        <KeyboardShortcuts />
        <AppSidebar userEmail={email} />
        <main className="flex min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </LookToggle>
  );
}
