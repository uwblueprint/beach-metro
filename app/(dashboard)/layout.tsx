import { AppSidebar } from "@/components/app-sidebar";
import { getClaims } from "@/lib/supabase/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const claims = await getClaims();
  const email = typeof claims?.email === "string" ? claims.email : null;

  return (
    <div className="flex flex-1">
      <AppSidebar userEmail={email} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
