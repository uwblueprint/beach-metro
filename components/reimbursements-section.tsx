"use client";

import { useState } from "react";

import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import type { CaptainPayoutHistoryEntry } from "@/features/members/api";
import { cn } from "@/lib/utils";

const VISIBLE_COUNT = 4;

const MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function ReimbursementRow({ entry }: { entry: CaptainPayoutHistoryEntry }) {
  return (
    <SidePanelRow meta={formatDate(entry.issueDate)}>
      {entry.role === "covered_by" ? (
        <span className="text-secondary">
          {entry.issueName} · covered by {entry.substitutedBy}
        </span>
      ) : (
        <span className="text-primary">
          ${entry.amount.toFixed(2)} ·{" "}
          {entry.role === "covered_for" ? `Covered for ${entry.coveredFor}` : entry.issueName}
          {entry.paid ? " · paid" : ""}
        </span>
      )}
    </SidePanelRow>
  );
}

interface ReimbursementsSectionProps {
  captainId: string;
  payouts: CaptainPayoutHistoryEntry[] | undefined;
  isPending: boolean;
}

function ReimbursementsSection({
  captainId: _captainId,
  payouts,
  isPending,
}: ReimbursementsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = payouts ?? [];
  const preview = rows.slice(0, VISIBLE_COUNT);
  const extra = rows.slice(VISIBLE_COUNT);
  const hasMore = extra.length > 0;

  return (
    <SidePanelSection title="Reimbursements">
      {isPending ? (
        <SidePanelRow className="text-secondary">Loading…</SidePanelRow>
      ) : rows.length === 0 ? (
        <SidePanelRow className="text-secondary">No Record of Reimbursement</SidePanelRow>
      ) : (
        <>
          {preview.map((entry) => (
            <ReimbursementRow key={entry.id} entry={entry} />
          ))}
          {hasMore ? (
            <>
              <div className="t-reimburse-list-expand grid" data-open={expanded ? "true" : "false"}>
                <div className="min-h-0 overflow-hidden">
                  {extra.map((entry) => (
                    <ReimbursementRow key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-expanded={expanded}
                className={cn(
                  "mt-1 self-start text-md text-secondary transition-colors",
                  "hover:text-primary active:scale-[0.98]",
                )}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? "See less" : "See more"}
              </button>
            </>
          ) : null}
        </>
      )}
    </SidePanelSection>
  );
}

export { ReimbursementsSection };
