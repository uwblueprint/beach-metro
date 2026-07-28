"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, MoreHorizontal, X } from "lucide-react";

import { ArchiveBanner } from "@/components/archive-banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  CHART_MONTHS,
  CHART_YTD_TOTAL,
  OVERVIEW_YEAR_DATE_RANGES,
  OVERVIEW_YEAR_OPTIONS,
  PAPERS_PER_ISSUE,
  PERIOD_DATA,
  PERIOD_OPTIONS,
  STATS,
  formatCount,
  formatCurrency,
  type OverviewYear,
  type PaymentPeriod,
} from "./data";

const PAPERS_PREVIEW_COUNT = 3;
const CHART_MAX = Math.max(...CHART_MONTHS.map((month) => month.amount), 1);
const CHART_BAR_MAX_HEIGHT = 100;
const CHART_BAR_GAP = 20;

function getTodayLineLeft(monthIndex: number) {
  const gapTotal = (CHART_MONTHS.length - 1) * CHART_BAR_GAP;
  return `calc(${monthIndex + 1} * (100% - ${gapTotal}px) / ${CHART_MONTHS.length} + ${monthIndex * CHART_BAR_GAP}px)`;
}

const CHART_COLORS = {
  past: "#B1E6FB",
  pastHover: "#3BAFDA",
} as const;

function getBarHeight(month: (typeof CHART_MONTHS)[number]) {
  if (month.amount === 0) return 0;
  if (month.label === "Jul") return CHART_BAR_MAX_HEIGHT * 0.1;
  return Math.max((month.amount / CHART_MAX) * CHART_BAR_MAX_HEIGHT, 8);
}

function getBarBackground(
  _month: (typeof CHART_MONTHS)[number],
  index: number,
  hoveredBarIndex: number | null,
) {
  const isHovered = hoveredBarIndex === index;
  return isHovered ? CHART_COLORS.pastHover : CHART_COLORS.past;
}

function YtdRunningCostChart() {
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | null>(null);
  const todayMonthIndex = CHART_MONTHS.findIndex((month) => month.label === "Jul");
  const todayLineLeft = todayMonthIndex >= 0 ? getTodayLineLeft(todayMonthIndex) : null;

  return (
    <div className="relative w-full pt-5">
      <div className="relative w-full" style={{ height: CHART_BAR_MAX_HEIGHT }}>
        {todayLineLeft !== null && (
          <div
            className="pointer-events-none absolute z-10 flex flex-col items-center"
            style={{ left: todayLineLeft, top: "-1.25rem", bottom: 0 }}
          >
            <span className="mb-1 text-xs whitespace-nowrap text-gray-400">Today</span>
            <div className="w-px flex-1 bg-gray-300" />
          </div>
        )}

        <div className="flex h-full w-full items-end gap-[20px]">
          {CHART_MONTHS.map((month, index) => {
            const barHeight = getBarHeight(month);
            const hasBar = barHeight > 0;
            const isHovered = hoveredBarIndex === index;

            return (
              <div key={month.label} className="relative min-w-0 flex-1">
                {hasBar && (
                  <div className="relative w-full">
                    <span
                      aria-hidden={!isHovered}
                      className={cn(
                        "pointer-events-none absolute bottom-full left-1/2 z-20 mb-0.5 -translate-x-1/2 whitespace-nowrap text-sm font-medium text-primary transition-opacity duration-300 ease-out",
                        isHovered ? "opacity-100" : "opacity-0",
                      )}
                    >
                      {formatCurrency(month.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label={`${month.label}: ${formatCurrency(month.amount)}`}
                      className="w-full rounded-t-lg rounded-b-none transition-[opacity,background-color] duration-300 ease-out"
                      style={{
                        height: barHeight,
                        backgroundColor: getBarBackground(month, index, hoveredBarIndex),
                        opacity: hoveredBarIndex !== null && hoveredBarIndex !== index ? 0.35 : 1,
                      }}
                      onMouseEnter={() => setHoveredBarIndex(index)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      onFocus={() => setHoveredBarIndex(index)}
                      onBlur={() => setHoveredBarIndex(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex w-full gap-[20px]">
        {CHART_MONTHS.map((month) => {
          const hasBar = getBarHeight(month) > 0;

          return (
            <span
              key={month.label}
              className={cn(
                "min-w-0 flex-1 text-center text-xs",
                hasBar ? "text-muted-foreground" : "text-gray-400",
              )}
            >
              {month.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">{value}</p>
      <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
    </div>
  );
}

function PaymentRow({ name, meta, amount }: { name: string; meta: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3.5 last:border-b-0">
      <div className="min-w-0">
        <span className="text-md font-medium text-primary">{name}</span>
        <span className="ml-3 text-md text-muted-foreground">{meta}</span>
      </div>
      <span className="shrink-0 text-md font-medium tabular-nums text-primary">{amount}</span>
    </div>
  );
}

export default function OverviewPage() {
  const [selectedYear, setSelectedYear] = React.useState<OverviewYear>("2025-26");
  const [yearOpen, setYearOpen] = React.useState(false);
  const [showArchiveBanner, setShowArchiveBanner] = React.useState(false);
  const [period, setPeriod] = React.useState<PaymentPeriod>("ytd");
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [papersDialogOpen, setPapersDialogOpen] = React.useState(false);

  const periodData = PERIOD_DATA[period];
  const selectedYearOption = OVERVIEW_YEAR_OPTIONS.find((option) => option.id === selectedYear);

  function handleSelectYear(year: OverviewYear, archived: boolean) {
    setSelectedYear(year);
    setYearOpen(false);
    setShowArchiveBanner(archived);
  }

  return (
    <div className="page-container">
      <div className="page">
        <div className="flex flex-col gap-4 p-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-md text-muted-foreground">Overview</span>
              <span className="text-md text-muted-foreground">/</span>
              <Popover open={yearOpen} onOpenChange={setYearOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-md font-medium text-primary"
                    >
                      {selectedYear}
                      <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
                    </button>
                  }
                />
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="w-auto gap-0 rounded-xl p-2 shadow-md ring-1 ring-foreground/10"
                >
                  {OVERVIEW_YEAR_OPTIONS.map((option) => {
                    const isSelected = selectedYear === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectYear(option.id, option.archived)}
                        className="flex w-full rounded-md px-3 py-2.5 text-left text-md text-primary hover:bg-tag-hover"
                      >
                        {option.archived ? (
                          <span className={cn(isSelected && "font-medium")}>
                            {option.label.replace(" (archived)", "")}
                            <span className="text-muted-foreground"> (archived)</span>
                          </span>
                        ) : (
                          <span className={cn(isSelected && "font-medium")}>{option.label}</span>
                        )}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="outline" size="icon-sm" className="text-muted-foreground">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </div>

          {showArchiveBanner && selectedYearOption?.archived && (
            <ArchiveBanner
              dateRange={OVERVIEW_YEAR_DATE_RANGES[selectedYear]}
              onDismiss={() => setShowArchiveBanner(false)}
            />
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Papers for next issue"
              value={formatCount(STATS.nextIssuePapers)}
              sub={STATS.nextIssueLabel}
            />
            <StatCard
              label="Active volunteers"
              value={String(STATS.activeVolunteers)}
              sub={`of ${STATS.totalVolunteers} total`}
            />
            <StatCard
              label="Routes missing a carrier"
              value={String(STATS.routesMissingCarrier)}
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
              value={formatCurrency(STATS.ytdCaptainCosts).replace(".00", "")}
              sub={`${STATS.ytdIssueCount} issues`}
            />
          </div>

          {/* YTD Running Cost chart */}
          <div className="rounded-lg border border-border bg-bg px-6 py-5">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-md font-semibold text-primary">YTD Running Cost</h2>
              <p className="text-md text-muted-foreground">
                {CHART_YTD_TOTAL.label}{" "}
                <span className="font-semibold text-primary">
                  {formatCurrency(CHART_YTD_TOTAL.amount)}
                </span>
              </p>
            </div>

            <YtdRunningCostChart />
          </div>

          {/* Captain Payments */}
          <div className="rounded-lg border border-border bg-bg px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-md font-semibold text-primary">Captain Payments</h2>
                <p className="mt-1 text-sm text-muted-foreground">{periodData.range}</p>
              </div>

              <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" size="sm" className="gap-1.5 font-medium">
                      {periodData.label}
                      <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
                    </Button>
                  }
                />
                <PopoverContent align="end" side="bottom" sideOffset={4} className="w-44 gap-0 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPeriod("ytd");
                      setPeriodOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className={cn(period === "ytd" && "font-medium")}>YTD</span>
                    {period === "ytd" && (
                      <Check className="size-3.5 text-active" strokeWidth={2.5} />
                    )}
                  </button>

                  <div className="my-1 h-px bg-hairline" />

                  {PERIOD_OPTIONS.filter((option) => option.id !== "ytd").map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setPeriod(option.id);
                        setPeriodOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className={cn(period === option.id && "font-medium")}>
                        {option.menuLabel}
                      </span>
                      {period === option.id && (
                        <Check className="size-3.5 text-active" strokeWidth={2.5} />
                      )}
                    </button>
                  ))}

                  <div className="my-1 h-px bg-hairline" />
                  <button
                    type="button"
                    onClick={() => setPeriodOpen(false)}
                    className="flex w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    Custom range
                  </button>
                </PopoverContent>
              </Popover>
            </div>

            <div className="mt-4">
              {periodData.captains.map((captain) => (
                <PaymentRow
                  key={captain.name}
                  name={captain.name}
                  meta={`${captain.type} • ${captain.frequency}`}
                  amount={formatCurrency(captain.amount)}
                />
              ))}
            </div>

            {periodData.substitutes.length > 0 && (
              <>
                <p className="mt-6 mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Substitute Payments
                </p>
                {periodData.substitutes.map((sub) => (
                  <PaymentRow
                    key={sub.name}
                    name={sub.name}
                    meta={`Covered ${sub.coveredCaptain} • ${sub.issueCount} ${sub.issueCount === 1 ? "issue" : "issues"}`}
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
              {PAPERS_PER_ISSUE.slice(0, PAPERS_PREVIEW_COUNT).map((issue) => (
                <div
                  key={issue.issue}
                  className="flex items-center justify-between gap-4 border-b border-hairline py-3.5 last:border-b-0"
                >
                  <div>
                    <span className="text-md font-semibold text-primary">Issue {issue.issue}</span>
                    <span className="ml-2 text-md text-muted-foreground">{issue.date}</span>
                  </div>
                  <span className="text-md font-medium tabular-nums text-primary">
                    {formatCount(issue.count)}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPapersDialogOpen(true)}
              className="mt-3 inline-flex items-center gap-0.5 text-sm text-active hover:text-active-hover"
            >
              View all {STATS.ytdIssueCount} issues
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={papersDialogOpen} onOpenChange={setPapersDialogOpen}>
        <DialogContent className="gap-0 border-hairline p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <DialogTitle className="text-lg font-semibold text-primary">
              Papers per issue
            </DialogTitle>
            <Button
              type="button"
              variant="text"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => setPapersDialogOpen(false)}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {PAPERS_PER_ISSUE.map((issue, index) => (
              <div
                key={issue.issue}
                className={cn(
                  "flex items-center justify-between gap-4 border-b border-hairline py-3",
                  index === PAPERS_PER_ISSUE.length - 1 && "border-b-0",
                )}
              >
                <div className="min-w-0">
                  <span className="text-md font-medium text-primary">Issue {issue.issue}</span>
                  <span className="ml-2 text-md text-muted-foreground">{issue.date}</span>
                </div>
                <span className="shrink-0 text-md font-medium tabular-nums text-primary">
                  {formatCount(issue.count)}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-4">
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
