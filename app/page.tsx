import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Beach Metro</h1>
      <p className="text-muted-foreground max-w-md text-lg">
        Internal distribution management. Backend scaffold is up; flows are on the way.
      </p>
      <form action="/auth/signout" method="post">
        <Button type="submit">Sign out</Button>
      </form>
    </main>
  );
}
