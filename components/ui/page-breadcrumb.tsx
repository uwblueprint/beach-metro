import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageBreadcrumbProps = {
  /** First segment — page title (h1). Not clickable. */
  root: string;
  /** Current segment — use a `Button variant="text"` (with optional trailing icon) when interactive. */
  current: ReactNode;
  /** Optional trailing actions (right side of the header row). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared page header used by Overview and Finances — same `page-header-container`
 * chrome as Members / Routes / Labels (`Root / Current` + optional actions).
 */
function PageBreadcrumb({ root, current, actions, className }: PageBreadcrumbProps) {
  return (
    <div className={cn("page-header-container", className)}>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5">
        <h1 className="shrink-0 text-md text-muted-foreground">{root}</h1>
        <span aria-hidden className="shrink-0 text-md text-muted-foreground">
          /
        </span>
        <div className="flex min-w-0 items-center">{current}</div>
      </nav>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export { PageBreadcrumb };
export type { PageBreadcrumbProps };
