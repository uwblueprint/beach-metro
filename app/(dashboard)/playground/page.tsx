// TEMPORARY PAGE — API playground for designers/product to poke the real
// backend: every endpoint as a friendly form, guided walkthroughs of the core
// business flows, and the live list of open items. Delete this folder,
// app/api/playground/, and the sidebar link when the real screens exist.
import { readFileSync } from "node:fs";
import path from "node:path";

import { Explorer, ResetSandboxButton, Walkthroughs } from "./client";
import { renderMarkdown } from "./markdown";

// Re-read docs/open_items.md on every request so the section stays current.
export const dynamic = "force-dynamic";

export default function PlaygroundPage() {
  let openItemsHtml: string;
  try {
    const md = readFileSync(path.join(process.cwd(), "docs", "open_items.md"), "utf8");
    openItemsHtml = renderMarkdown(md);
  } catch {
    openItemsHtml = "<p>Could not read docs/open_items.md.</p>";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">API Playground</h1>
        <p className="text-muted-foreground text-sm">
          A temporary, throwaway page for exploring the Beach Metro backend without writing code.
          Everything here talks to the <strong>real hosted database</strong> through the same API
          the product will use — create things, break rules on purpose, watch the money math react.
          When data gets messy, reset it. This page will be deleted once the real screens exist; the
          API it demonstrates is the durable part.
        </p>
        <ResetSandboxButton />
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Guided walkthroughs</h2>
        <p className="text-muted-foreground text-sm">
          Start here. Each strip walks a real business flow step by step — every step shows the
          exact request sent and the live response, including the errors we trigger on purpose
          (those amber 409s are the business rules working).
        </p>
        <Walkthroughs />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">All endpoints</h2>
        <p className="text-muted-foreground text-sm">
          The full surface, resource by resource. Each card explains the endpoint in plain English,
          shows the request/response shapes, and gives you a form that sends the real thing.
          Dropdowns are populated live from the database (hit ↻ after creating something).
        </p>
        <Explorer />
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-xl font-semibold">Still open — to be calculated or decided</h2>
        <p className="text-muted-foreground text-sm">
          Rendered live from <code className="font-mono text-xs">docs/open_items.md</code>, so this
          list is always current with the repo. If something you expected to test is missing above,
          it is probably in here.
        </p>
        <div
          className="[&_code]:bg-muted [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-medium [&_a]:underline [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_del]:opacity-60 [&_h3]:mt-4 [&_h4]:mt-3 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 space-y-1 text-sm"
          dangerouslySetInnerHTML={{ __html: openItemsHtml }}
        />
      </section>
    </div>
  );
}
