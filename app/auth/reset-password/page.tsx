import Link from "next/link";

import { requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-muted-foreground text-sm">
            We&apos;ll email you a link to set a new one.
          </p>
        </div>

        {sent ? (
          <p className="text-sm" role="status">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" className="w-full">
              Send reset link
            </Button>
          </form>
        )}

        <p className="text-muted-foreground text-center text-sm">
          <Link href="/auth/login" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
