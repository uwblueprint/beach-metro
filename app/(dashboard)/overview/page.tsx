"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";

import { ArchiveBanner } from "@/components/archive-banner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOverview, useYears, type Overview } from "@/features/finances/api";
import { cn } from "@/lib/utils";

import {
  PERIOD_OPTIONS,
  formatCount,
  formatCurrency,
  formatIssueDate,
  monthLabel,
  monthYearLabel,
  yearDateRange,
  type PaymentPeriod,
} from "./data";

const PAPERS_PREVIEW_COUNT = 3;
const CHART_BAR_MAX_HEIGHT = 100;
const CHART_BAR_GAP = 8;

const CHART_COLORS = {
  past: "#B8E4F5",
  pastHover: "#3BAFDA",
} as const;

type MonthlyCost = Overview["monthlyCosts"][number];

function getTodayLineLeft(monthIndex: number, monthCount: number) {
  const gapTotal = (monthCount - 1) * CHART_BAR_GAP;
  // Place the line after the current month bar (middle of the following gap).
  if (monthIndex >= monthCount - 1) {
    return "100%";
  }
  return `calc(${monthIndex + 1} * (100% - ${gapTotal}px) / ${monthCount} + ${monthIndex} * ${CHART_BAR_GAP}px + ${CHART_BAR_GAP / 2}px)`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg px-4 py-3.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-primary">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function PaymentRow({ name, meta, amount }: { name: string; meta: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <span className="text-md font-semibold text-primary">{name}</span>
        <span className="ml-2 text-md text-muted-foreground">{meta}</span>
      </div>
      <span className="shrink-0 text-md font-medium tabular-nums text-primary">{amount}</span>
    </div>
  );
}

/**
 * Twelve buckets in the year's own month order, straight from the API. The "today"
 * marker is worked out here rather than stored: the API returns amounts, and which
 * month is current is a question about the browser's clock, not the data.
 */
function YtdRunningCostChart({
  months,
  onHover,
}: {
  months: MonthlyCost[];
  onHover?: (index: number | null) => void;
}) {
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | null>(null);
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleHover(index: number | null) {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    if (index !== null) {
      setHoveredBarIndex(index);
      onHover?.(index);
    } else {
      leaveTimerRef.current = setTimeout(() => {
        setHoveredBarIndex(null);
        onHover?.(null);
      }, 150);
    }
  }

  React.useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    },
    [],
  );

  const chartMax = Math.max(...months.map((m) => m.amount), 1);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const todayMonthIndex = months.findIndex((m) => m.month === currentMonth);
  const todayLineLeft =
    todayMonthIndex >= 0 ? getTodayLineLeft(todayMonthIndex, months.length) : null;

  return (
    <div className="relative w-full pt-5">
      <div className="relative w-full" style={{ height: CHART_BAR_MAX_HEIGHT }}>
        {todayLineLeft !== null && (
          <div
            className="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col items-center"
            style={{ left: todayLineLeft, top: "-1.25rem", bottom: 0 }}
          >
            <span className="mb-1 text-xs text-muted-foreground">Today</span>
            <div className="w-px flex-1 bg-hairline" />
          </div>
        )}

        <div className="flex h-full items-end" style={{ gap: CHART_BAR_GAP }}>
          {months.map((month, index) => {
            const isEmpty = month.amount === 0;
            const isPast = month.month <= currentMonth;
            const height = isEmpty
              ? 4
              : Math.max((month.amount / chartMax) * CHART_BAR_MAX_HEIGHT, 8);
            const isHovered = hoveredBarIndex === index;

            return (
              <div
                key={month.month}
                className="relative flex-1"
                onMouseEnter={() => handleHover(index)}
                onMouseLeave={() => handleHover(null)}
              >
                {isHovered && isPast && (
                  <div className="absolute -top-7 left-1/2 z-20 -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-xs whitespace-nowrap text-bg">
                    {formatCurrency(month.amount)}
                  </div>
                )}
                <div
                  className="w-full rounded-t-md transition-[background-color] duration-200"
                  style={{
                    height,
                    backgroundColor: !isPast
                      ? "#E5E7EB"
                      : isHovered
                        ? CHART_COLORS.pastHover
                        : CHART_COLORS.past,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex" style={{ gap: CHART_BAR_GAP }}>
        {months.map((month) => (
          <span key={month.month} className="flex-1 text-center text-xs text-muted-foreground">
            {monthLabel(month.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [selectedYearId, setSelectedYearId] = React.useState<string | null>(null);
  const [showArchiveBanner, setShowArchiveBanner] = React.useState(false);
  const [captainPeriod, setCaptainPeriod] = React.useState<PaymentPeriod>("ytd");
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [hoveredChartIndex, setHoveredChartIndex] = React.useState<number | null>(null);
  const [papersDialogOpen, setPapersDialogOpen] = React.useState(false);

  const { data: years } = useYears();
  // Default to the most recent non-archived year, which is what the API picks when
  // no yearId is sent, so the first render and the first fetch agree.
  const defaultYear = years?.find((y) => !y.archived) ?? years?.[0];
  const activeYearId = selectedYearId ?? defaultYear?.id;
  const selectedYearOption = years?.find((y) => y.id === activeYearId);
  const yearOptions = (years ?? []).map((y) => ({
    id: y.id,
    label: y.archived ? `${y.name} (archived)` : y.name,
    archived: y.archived,
  }));

  // Chart, stat cards, and papers always show YTD. Captain payments use their own period picker.
  const { data: overview, isPending, isError, error } = useOverview(activeYearId, "ytd");
  const { data: captainOverview } = useOverview(activeYearId, captainPeriod);

  function handleSelectYear(yearId: string) {
    const next = yearOptions.find((o) => o.id === yearId);
    setSelectedYearId(yearId);
    setShowArchiveBanner(next?.archived ?? false);
  }

  const periodLabel = PERIOD_OPTIONS.find((o) => o.id === captainPeriod)?.menuLabel ?? "YTD";
  const papersPerIssue = overview?.papersPerIssue ?? [];

  return (
    <div className="page-container">
      <div className="page">
        <div className="flex flex-col gap-4 p-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* The breadcrumb's first segment is the page's only title, so it
                  carries the h1. Same classes, so it renders identically. */}
              <h1 className="text-md text-muted-foreground">Overview</h1>
              <span className="text-md text-muted-foreground">/</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Switch year"
                      className="inline-flex items-center gap-1"
                    >
                      <span className="text-md font-medium text-primary">
                        {selectedYearOption?.name ?? "…"}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
                    </button>
                  }
                />
                <DropdownMenuContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="min-w-56"
                >
                  <DropdownMenuRadioGroup
                    value={activeYearId ?? ""}
                    onValueChange={handleSelectYear}
                  >
                    {yearOptions.map((option) => {
                      const isSelected = option.id === activeYearId;

                      return (
                        <DropdownMenuRadioItem
                          key={option.id}
                          value={option.id}
                          className={cn(
                            "data-checked:font-medium",
                            option.archived && !isSelected && "text-muted-foreground",
                          )}
                        >
                          {option.label}
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {showArchiveBanner && selectedYearOption?.archived && (
            <ArchiveBanner
              dateRange={yearDateRange(selectedYearOption.startDate)}
              onDismiss={() => setShowArchiveBanner(false)}
            />
          )}

          {isError ? (
            <p className="p-2 text-md text-secondary">
              {error instanceof Error ? error.message : "Could not load the overview."}
            </p>
          ) : isPending || !overview ? (
            <p className="p-2 text-md text-secondary">Loading overview…</p>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                <StatCard
                  label="Papers for next issue"
                  value={formatCount(overview.stats.nextIssue?.papers ?? 0)}
                  sub={
                    overview.stats.nextIssue
                      ? `${overview.stats.nextIssue.name} • ${formatIssueDate(overview.stats.nextIssue.date)}`
                      : "No issue scheduled"
                  }
                />
                <StatCard
                  label="Active volunteers"
                  value={String(overview.stats.activeVolunteers)}
                  sub={`of ${overview.stats.totalVolunteers} total`}
                />
                <StatCard
                  label="Routes missing a carrier"
                  value={String(overview.stats.routesMissingCarrier)}
                  sub={
                    <Link
                      href="/routes"
                      className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-primary"
                    >
                      View routes
                      <ArrowUpRight className="size-3.5" strokeWidth={2} />
                    </Link>
                  }
                />
                <StatCard
                  label="YTD captain costs"
                  value={formatCurrency(overview.stats.captainCosts).replace(".00", "")}
                  sub={`${overview.stats.issueCount} ${overview.stats.issueCount === 1 ? "issue" : "issues"}`}
                />
              </div>

              {/* YTD Running Cost chart */}
              <div className="rounded-lg border border-border bg-bg px-6 py-5">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h2 className="text-md font-semibold text-primary">YTD Running Cost</h2>
                  <p className="text-md text-muted-foreground transition-opacity duration-300">
                    {hoveredChartIndex !== null ? (
                      <>
                        {monthYearLabel(overview.monthlyCosts[hoveredChartIndex].month)}{" "}
                        <span className="font-semibold text-primary">
                          {formatCurrency(overview.monthlyCosts[hoveredChartIndex].amount)}
                        </span>
                      </>
                    ) : (
                      <>
                        {overview.year.name} total{" "}
                        <span className="font-semibold text-primary">
                          {formatCurrency(overview.monthlyCosts.reduce((s, m) => s + m.amount, 0))}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <YtdRunningCostChart
                  months={overview.monthlyCosts}
                  onHover={setHoveredChartIndex}
                />
              </div>

              {/* Captain Payments */}
              <div className="rounded-lg border border-border bg-bg px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-md font-semibold text-primary">Captain Payments</h2>
                    {captainOverview && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatIssueDate(captainOverview.range.from)} –{" "}
                        {formatIssueDate(captainOverview.range.to)}
                      </p>
                    )}
                  </div>

                  <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
                    <PopoverTrigger
                      render={
                        <Button variant="outline" size="sm" className="gap-1.5 font-medium">
                          {periodLabel}
                          <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
                        </Button>
                      }
                    />
                    <PopoverContent
                      align="end"
                      side="bottom"
                      sideOffset={4}
                      className="w-44 gap-0 p-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCaptainPeriod("ytd");
                          setPeriodOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className={cn(captainPeriod === "ytd" && "font-medium")}>YTD</span>
                        {captainPeriod === "ytd" && (
                          <Check className="size-3.5 text-active" strokeWidth={2.5} />
                        )}
                      </button>

                      <div className="my-1 h-px bg-hairline" />

                      {PERIOD_OPTIONS.filter((option) => option.id !== "ytd").map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setCaptainPeriod(option.id);
                            setPeriodOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className={cn(captainPeriod === option.id && "font-medium")}>
                            {option.menuLabel}
                          </span>
                          {captainPeriod === option.id && (
                            <Check className="size-3.5 text-active" strokeWidth={2.5} />
                          )}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="mt-4">
                  {(captainOverview?.captainPayments.length ?? 0) === 0 ? (
                    <p className="py-3.5 text-md text-muted-foreground">
                      No captain payments in this period.
                    </p>
                  ) : (
                    captainOverview!.captainPayments.map((captain) => (
                      <PaymentRow
                        key={captain.captainId}
                        name={captain.captainName}
                        meta={`${captain.payType} • ${captain.payCadence}`}
                        amount={formatCurrency(captain.amount)}
                      />
                    ))
                  )}
                </div>

                {(captainOverview?.substitutePayments.length ?? 0) > 0 && (
                  <>
                    <p className="mt-6 mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Substitute Payments
                    </p>
                    {captainOverview!.substitutePayments.map((sub) => (
                      <PaymentRow
                        key={sub.captainId}
                        name={sub.captainName}
                        // One person may cover several captains, so list them
                        // all rather than silently dropping any past the first.
                        meta={`Covered ${sub.coveredFor.map((c) => c.captainName).join(", ")} • ${sub.issueCount} ${sub.issueCount === 1 ? "issue" : "issues"}`}
                        amount={formatCurrency(sub.amount)}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* Papers Per Issue */}
              <div className="rounded-lg border border-border bg-bg px-6 py-5">
                <h2 className="text-md font-semibold text-primary">Papers Per Issue</h2>

                <div className="mt-4">
                  {papersPerIssue.length === 0 ? (
                    <p className="py-3.5 text-md text-muted-foreground">
                      No issues in this period yet.
                    </p>
                  ) : (
                    papersPerIssue.slice(0, PAPERS_PREVIEW_COUNT).map((issue) => (
                      <div
                        key={issue.issueId}
                        className="flex items-center justify-between gap-4 py-3.5"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="text-md font-semibold text-primary">
                            {issue.name.split(",")[0]}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatIssueDate(issue.date)}
                          </span>
                        </div>
                        <span className="text-md font-medium tabular-nums text-primary">
                          {formatCount(issue.papers)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {papersPerIssue.length > PAPERS_PREVIEW_COUNT && (
                  <button
                    type="button"
                    onClick={() => setPapersDialogOpen(true)}
                    className="mt-3 inline-flex items-center gap-0.5 text-sm text-active hover:text-active-hover"
                  >
                    View all {papersPerIssue.length} issues
                    <ArrowUpRight className="size-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={papersDialogOpen} onOpenChange={setPapersDialogOpen}>
        <DialogContent className="gap-0 border-hairline">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-primary">
              Papers per issue
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-4">
            {papersPerIssue.map((issue) => (
              <div key={issue.issueId} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="text-md font-medium text-primary">
                    {issue.name.split(",")[0]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatIssueDate(issue.date)}
                  </span>
                </div>
                <span className="shrink-0 text-md font-medium tabular-nums text-primary">
                  {formatCount(issue.papers)}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPapersDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
