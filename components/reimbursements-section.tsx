"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SidePanelRow } from "@/components/side-panel-row";
import { SidePanelSection } from "@/components/side-panel-section";
import { Button } from "@/components/ui/button";
import type { CaptainReimbursement, CaptainReimbursementsResult } from "@/lib/services/payouts";

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

function formatPaidAt(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function description(item: CaptainReimbursement): string {
  if (item.kind === "substitute" && item.coveredForName) {
    return `Covered for ${item.coveredForName}`;
  }
  return item.issue.name;
}

interface ReimbursementsSectionProps {
  captainId: string;
}

function ReimbursementsSection({ captainId }: ReimbursementsSectionProps) {
  const router = useRouter();
  const [items, setItems] = useState<CaptainReimbursement[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const financesHref = `/finances?captainId=${captainId}`;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/captains/${captainId}/payouts?limit=4`);
        if (!res.ok) {
          if (!cancelled) {
            setItems([]);
            setHasMore(false);
          }
          return;
        }
        const body = (await res.json()) as { data: CaptainReimbursementsResult };
        if (cancelled) return;
        setItems(body.data.items);
        setHasMore(body.data.hasMore);
      } catch {
        if (!cancelled) {
          setItems([]);
          setHasMore(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [captainId]);

  return (
    <SidePanelSection title="Reimbursements">
      {items === null ? null : items.length === 0 ? (
        <SidePanelRow className="text-secondary">No Record of Reimbursement</SidePanelRow>
      ) : (
        <>
          {items.map((r) => (
            <SidePanelRow key={r.id} meta={formatPaidAt(r.paidAt)}>
              <span className="text-primary">
                <span className="tabular-nums">${r.amount.toFixed(2)}</span>
                {" — "}
                {description(r)}
              </span>
            </SidePanelRow>
          ))}
          {hasMore && (
            <div className="flex h-8 items-center px-2 py-1">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0"
                onClick={() => router.push(financesHref)}
              >
                See all
              </Button>
            </div>
          )}
        </>
      )}
    </SidePanelSection>
  );
}

export { ReimbursementsSection };
