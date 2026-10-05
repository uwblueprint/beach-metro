"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown } from "lucide-react";

import { ArchiveBanner } from "@/components/archive-banner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOverview, useYears, type Overview } from "@/features/finances/api";
import { cn } from "@/lib/utils";

import {
  formatCount,
  formatCurrency,
  formatIssueDate,
  monthLabel,
  monthYearLabel,
  yearDateRange,
} from "./data";

const PAPERS_PREVIEW_COUNT = 3;
/** Column is 130px; the 14px label (line-height 1.3) plus the 4px gap sit under the bar. */
const CHART_COLUMN_HEIGHT = 130;
const CHART_LABEL_BLOCK = 22;
const CHART_BAR_MAX_HEIGHT = CHART_COLUMN_HEIGHT - CHART_LABEL_BLOCK;
const CHART_BAR_GAP = 20;

const CHART_COLORS = {
  past: "#b1e6fb",
  pastHover: "#7ec8ee",
  empty: "#e8eaef",
} as const;

function labelCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

type MonthlyCost = Overview["monthlyCosts"][number];

/** Round up to 1/2/5 × 10ⁿ so axis ticks stay even ($500, $1,000) instead of the raw max. */
function niceAxisMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatAxisCurrency(amount: number) {
  if (amount === 0) return "$0";
  if (amount >= 1000) {
    const compact = amount / 1000;
    const digits = Number.isInteger(compact) ? 0 : 1;
    return `$${compact.toFixed(digits)}k`;
  }
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function getTodayLineLeft(monthIndex: number, monthCount: number) {
  const gapTotal = (monthCount - 1) * CHART_BAR_GAP;
  // Place the line after the current month bar (middle of the following gap).
  if (monthIndex >= monthCount - 1) {
    return "100%";
  }
  return `calc(${monthIndex + 1} * (100% - ${gapTotal}px) / ${monthCount} + ${monthIndex} * ${CHART_BAR_GAP}px + ${CHART_BAR_GAP / 2}px)`;
}

/**
 * Shell uses the sidebar fill. 4px pad + 16px inner radius → 20px outer,
 * so the gray rim stays thin instead of a heavy frame.
 */
function OverviewSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex w-full min-w-0 flex-col gap-1 rounded-[20px] bg-sidebar p-1 pt-2.5">
      {children}
    </section>
  );
}

function OverviewPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full rounded-[16px] border border-hairline bg-bg shadow-xs", className)}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <OverviewSection>
      <p className="px-2 text-sm font-medium text-secondary">{label}</p>
      <OverviewPanel className="px-4 py-2.5">
        <div className="flex flex-col gap-1">
          <p className="text-3xl font-semibold text-primary tabular-nums">{value}</p>
          <div className="text-sm font-medium text-secondary">{sub}</div>
        </div>
      </OverviewPanel>
    </OverviewSection>
  );
}

function PaymentRow({ name, meta, amount }: { name: string; meta: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-md font-medium text-primary">{name}</span>
        <span className="truncate text-sm font-medium text-secondary">{meta}</span>
      </div>
      <span className="shrink-0 text-md font-medium text-primary tabular-nums">{amount}</span>
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

  const axisMax = niceAxisMax(Math.max(...months.map((m) => m.amount), 0));
  const axisTicks = [axisMax, axisMax / 2, 0];
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" })
    .format(new Date())
    .slice(0, 7);
  const todayMonthIndex = months.findIndex((m) => m.month === currentMonth);
  const todayLineLeft =
    todayMonthIndex >= 0 ? getTodayLineLeft(todayMonthIndex, months.length) : null;

  return (
    <div className="flex w-full items-start gap-2">
      <div
        className="relative w-10 shrink-0 text-right text-sm font-medium text-secondary tabular-nums"
        style={{ height: CHART_BAR_MAX_HEIGHT }}
      >
        {axisTicks.map((tick) => (
          <span
            key={tick}
            className="absolute right-0 -translate-y-1/2"
            style={{ top: `${((axisMax - tick) / axisMax) * 100}%` }}
          >
            {formatAxisCurrency(tick)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: CHART_BAR_MAX_HEIGHT }}>
          {axisTicks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className="pointer-events-none absolute right-0 left-0 z-0 h-px bg-hairline"
              style={{ top: `${((axisMax - tick) / axisMax) * 100}%` }}
            />
          ))}

          {todayLineLeft !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center"
              style={{ left: todayLineLeft, height: CHART_BAR_MAX_HEIGHT }}
            >
              <span className="text-sm font-medium text-secondary">Today</span>
              <div className="w-px flex-1 bg-secondary/50" />
            </div>
          )}

          <div className="absolute inset-0 z-[1] flex items-end" style={{ gap: CHART_BAR_GAP }}>
            {months.map((month, index) => {
              // Gray only means "hasn't happened." A past or current month at $0 is a real result.
              const isFuture = month.month > currentMonth;
              const isPlaceholder = month.amount === 0 && isFuture;
              const height = Math.max((month.amount / axisMax) * 100, 8);
              const isHovered = hoveredBarIndex === index;

              return (
                <div
                  key={month.month}
                  className="relative flex h-full min-w-0 flex-1 items-end"
                  onMouseEnter={() => handleHover(index)}
                  onMouseLeave={() => handleHover(null)}
                >
                  <div
                    className="relative w-full"
                    style={{ height: month.amount === 0 ? 4 : `${height}%` }}
                  >
                    {isHovered && !isPlaceholder && (
                      <div className="absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-xs font-medium whitespace-nowrap text-bg">
                        {formatCurrency(month.amount)}
                      </div>
                    )}
                    <div
                      className="h-full w-full rounded-t-[4px] transition-[background-color] duration-200"
                      style={{
                        backgroundColor: isPlaceholder
                          ? CHART_COLORS.empty
                          : isHovered
                            ? CHART_COLORS.pastHover
                            : CHART_COLORS.past,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex" style={{ gap: CHART_BAR_GAP }}>
          {months.map((month) => (
            <span
              key={month.month}
              className="min-w-0 flex-1 text-center text-md font-medium text-primary"
            >
              {monthLabel(month.month)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [selectedYearId, setSelectedYearId] = React.useState<string | null>(null);
  const [showArchiveBanner, setShowArchiveBanner] = React.useState(false);
  const [captainMode, setCaptainMode] = React.useState<"ytd" | "custom">("ytd");
  const [captainStart, setCaptainStart] = React.useState("");
  const [captainEnd, setCaptainEnd] = React.useState("");
  const [draftStart, setDraftStart] = React.useState("");
  const [draftEnd, setDraftEnd] = React.useState("");
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
  const captainRange =
    captainMode === "custom" && captainStart && captainEnd
      ? { from: captainStart, to: captainEnd }
      : undefined;
  const { data: captainOverview } = useOverview(activeYearId, "ytd", captainRange);

  function handleSelectYear(yearId: string) {
    const next = yearOptions.find((o) => o.id === yearId);
    setSelectedYearId(yearId);
    setShowArchiveBanner(next?.archived ?? false);
  }

  const periodLabel =
    captainMode === "custom" && captainStart && captainEnd
      ? `${formatIssueDate(captainStart)} – ${formatIssueDate(captainEnd)}`
      : "YTD";
  const canApplyCustomRange = draftStart !== "" && draftEnd !== "" && draftStart <= draftEnd;

  function handlePeriodOpenChange(next: boolean) {
    if (next) {
      setDraftStart(captainMode === "custom" ? captainStart : "");
      setDraftEnd(captainMode === "custom" ? captainEnd : "");
    }
    setPeriodOpen(next);
  }

  function applyCustomRange() {
    setCaptainStart(draftStart);
    setCaptainEnd(draftEnd);
    setCaptainMode("custom");
    setPeriodOpen(false);
  }

  const papersPerIssue = overview?.papersPerIssue ?? [];

  return (
    <div className="page-container">
      <div className="page">
        <div className="flex h-full min-h-0 flex-col">
          <PageBreadcrumb
            className="pr-[18px]"
            root="Overview"
            current={
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      aria-label="Switch year"
                      className="-ml-1 gap-1 px-1.5 font-medium"
                    />
                  }
                >
                  <span className="text-md">{selectedYearOption?.name ?? "…"}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
                </DropdownMenuTrigger>
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
            }
          />

          <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto p-4">
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
                <div className="grid grid-cols-4 gap-4">
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
                        className="inline-flex items-center gap-0.5 text-secondary transition-colors duration-150 hover:text-primary"
                      >
                        View routes
                        <ArrowUpRight className="size-3" strokeWidth={2} />
                      </Link>
                    }
                  />
                  <StatCard
                    label="YTD captain costs"
                    value={formatCurrency(overview.stats.captainCosts).replace(".00", "")}
                    sub={`${overview.stats.issueCount} ${overview.stats.issueCount === 1 ? "issue" : "issues"}`}
                  />
                </div>

                <OverviewSection>
                  <div className="flex items-center justify-between gap-4 px-2 text-md font-medium">
                    <h2 className="text-secondary">YTD Running Cost</h2>
                    <p className="text-secondary">
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
                            {formatCurrency(
                              overview.monthlyCosts.reduce((s, m) => s + m.amount, 0),
                            )}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <OverviewPanel className="px-4 py-5">
                    <YtdRunningCostChart
                      months={overview.monthlyCosts}
                      onHover={setHoveredChartIndex}
                    />
                  </OverviewPanel>
                </OverviewSection>

                <OverviewSection>
                  <div className="flex flex-col gap-2 px-2">
                    <h2 className="text-md font-medium text-primary">Captain Payments</h2>
                    <div className="flex items-center justify-between gap-4">
                      <p className="min-w-0 flex-1 text-sm font-medium text-secondary">
                        {captainOverview
                          ? captainMode === "ytd"
                            ? `${monthYearLabel(captainOverview.range.from)} – ${monthYearLabel(captainOverview.range.to)} (full year)`
                            : `${formatIssueDate(captainOverview.range.from)} – ${formatIssueDate(captainOverview.range.to)}`
                          : null}
                      </p>

                      <Popover open={periodOpen} onOpenChange={handlePeriodOpenChange}>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-[4px] bg-sidebar-active px-2 py-1 text-sm font-medium text-primary transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
                            >
                              {periodLabel}
                              <ChevronDown className="size-3" strokeWidth={2} />
                            </button>
                          }
                        />
                        <PopoverContent
                          align="end"
                          side="bottom"
                          sideOffset={4}
                          className="w-[280px] gap-0 p-1"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCaptainMode("ytd");
                              setPeriodOpen(false);
                            }}
                            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-bg-secondary"
                          >
                            <span className={cn(captainMode === "ytd" && "font-medium")}>YTD</span>
                            {captainMode === "ytd" && (
                              <Check className="size-3.5 text-active" strokeWidth={2.5} />
                            )}
                          </button>

                          <div className="my-1 h-px bg-hairline" />

                          <div className="flex flex-col gap-2 px-1.5 pt-1 pb-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Custom range
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <DatePicker
                                  label="Start Date"
                                  value={draftStart}
                                  onChange={setDraftStart}
                                />
                              </div>
                              <span aria-hidden className="shrink-0 text-sm text-muted-foreground">
                                →
                              </span>
                              <div className="min-w-0 flex-1">
                                <DatePicker
                                  label="End Date"
                                  value={draftEnd}
                                  onChange={setDraftEnd}
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={!canApplyCustomRange}
                              onClick={applyCustomRange}
                            >
                              Apply
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <OverviewPanel>
                    {(captainOverview?.captainPayments.length ?? 0) === 0 &&
                    (captainOverview?.substitutePayments.length ?? 0) === 0 ? (
                      <p className="px-4 py-3 text-md font-medium text-secondary">
                        No captain payments in this period.
                      </p>
                    ) : (
                      <>
                        {captainOverview!.captainPayments.map((captain) => (
                          <PaymentRow
                            key={`captain-${captain.captainId}`}
                            name={captain.captainName}
                            meta={`${labelCase(captain.payType)} • ${labelCase(captain.payCadence)}`}
                            amount={formatCurrency(captain.amount)}
                          />
                        ))}
                        {captainOverview!.substitutePayments.map((sub) => (
                          <PaymentRow
                            key={`substitute-${sub.captainId}`}
                            name={sub.captainName}
                            meta={`Covered ${sub.coveredFor.map((c) => c.captainName).join(", ")} • ${sub.issueCount} ${sub.issueCount === 1 ? "issue" : "issues"}`}
                            amount={formatCurrency(sub.amount)}
                          />
                        ))}
                      </>
                    )}
                  </OverviewPanel>
                </OverviewSection>

                <OverviewSection>
                  <h2 className="px-2 text-md font-medium text-primary">Papers Per Issue</h2>

                  <OverviewPanel>
                    {papersPerIssue.length === 0 ? (
                      <p className="px-4 py-3 text-md font-medium text-secondary">
                        No issues in this period yet.
                      </p>
                    ) : (
                      papersPerIssue.slice(0, PAPERS_PREVIEW_COUNT).map((issue) => (
                        <div
                          key={issue.issueId}
                          className="flex items-center justify-between gap-4 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="text-md font-medium text-primary">
                              {issue.name.split(",")[0]}
                            </span>
                            <span className="text-sm font-medium text-secondary">
                              {formatIssueDate(issue.date)}
                            </span>
                          </div>
                          <span className="text-md font-medium text-primary tabular-nums">
                            {formatCount(issue.papers)}
                          </span>
                        </div>
                      ))
                    )}

                    {papersPerIssue.length > PAPERS_PREVIEW_COUNT && (
                      <button
                        type="button"
                        onClick={() => setPapersDialogOpen(true)}
                        className="inline-flex items-center gap-1 px-4 py-3 text-md font-medium text-primary"
                      >
                        View all {papersPerIssue.length} issues
                        <ArrowRight className="size-3" strokeWidth={2} />
                      </button>
                    )}
                  </OverviewPanel>
                </OverviewSection>
              </>
            )}
          </div>
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
              variant="default"
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
