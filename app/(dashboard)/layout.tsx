import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { getClaims } from "@/lib/supabase/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const claims = await getClaims();
  const email = typeof claims?.email === "string" ? claims.email : null;

  return (
    <div className="flex h-screen flex-1 overflow-hidden">
      <KeyboardShortcuts />
      <AppSidebar userEmail={email} />
      <main className="flex min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
