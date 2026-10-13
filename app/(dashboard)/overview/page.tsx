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
import { useOriginalLook, useTweak } from "@/components/dev-look-toggle";
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
const PAIRED_CARDS_QUERY = "(min-width: 1024px)";
/** Width stays fixed so rows do not shift. Only the thumb turns visible on hover. */
const pairedScroll =
  "min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:color-mix(in_oklch,var(--foreground)_30%,transparent)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-foreground/30";

function subscribePairedWidth(onChange: () => void) {
  const media = window.matchMedia(PAIRED_CARDS_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function pairedWidthSnapshot() {
  return window.matchMedia(PAIRED_CARDS_QUERY).matches;
}

function columnGap(parent: HTMLElement) {
  if (parent.children.length < 2) return 0;
  const style = getComputedStyle(parent);
  if (style.display !== "flex" && style.display !== "inline-flex") return 0;
  if (style.flexDirection.startsWith("row")) return 0;
  const raw = style.rowGap && style.rowGap !== "normal" ? style.rowGap : style.gap;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

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
function readCssDurationMs(el: Element, variable: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw) || fallback;
}

/** Replays the transitions-dev digit pop-in whenever `value` changes. */
function DigitGroup({ value, className }: { value: string; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const first = React.useRef(true);
  const chars = value.split("");

  React.useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    if (first.current) {
      first.current = false;
      group.classList.add("is-animating");
      return;
    }
    group.classList.remove("is-animating");
    void group.offsetHeight;
    group.classList.add("is-animating");
  }, [value]);

  return (
    <span ref={ref} className={cn("t-digit-group", className)}>
      {chars.map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className="t-digit"
          data-stagger={i === chars.length - 2 ? "1" : i === chars.length - 1 ? "2" : undefined}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

/** In-place text swap from transitions-dev. The node owns its text so the exit can finish. */
function TextSwap({ text, className }: { text: string; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const latest = React.useRef(text);
  const timer = React.useRef<number | null>(null);
  const ready = React.useRef(false);
  latest.current = text;

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!ready.current) {
      el.textContent = text;
      ready.current = true;
      return;
    }
    // A swap is already running. It reads `latest` when it lands, so scrubbing
    // does not restart the exit and snap the old text back.
    if (timer.current !== null) return;
    if (el.textContent === text) return;

    const dur = readCssDurationMs(el, "--text-swap-dur", 200);
    el.classList.add("is-exit");
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const node = ref.current;
      if (!node) return;
      node.textContent = latest.current;
      node.classList.remove("is-exit");
      node.classList.add("is-enter-start");
      void node.offsetWidth;
      node.classList.remove("is-enter-start");
    }, dur);
  }, [text]);

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return <span ref={ref} className={cn("t-text-swap", className)} />;
}

function OverviewSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const section = useTweak(
    "flex w-full min-w-0 flex-col gap-2 rounded-[20px] bg-bg-secondary p-1 pt-3",
    "flex w-full min-w-0 flex-col gap-1 rounded-[20px] bg-bg-secondary p-1 pt-2.5",
  );
  return <section className={cn(section, className)}>{children}</section>;
}

function OverviewPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  const edge = useTweak("shadow-[0_1px_2px_rgba(0,0,0,0.05)]", "border border-hairline shadow-xs");
  return <div className={cn("w-full rounded-[16px] bg-bg", edge, className)}>{children}</div>;
}

function StatCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  href: string;
}) {
  const original = useOriginalLook();
  const titlePad = useTweak("px-4", "px-2");
  const titleStyle = useTweak(
    "text-md font-medium text-secondary",
    "text-sm font-medium text-secondary",
  );
  const body = (
    <>
      <p
        className={cn(
          original ? "px-2 text-sm font-medium text-secondary" : cn(titleStyle, titlePad),
          !original && "transition-colors duration-150 group-hover:text-primary",
        )}
      >
        {label}
      </p>
      <OverviewPanel className="px-4 py-2.5">
        <div className="flex flex-col gap-1">
          <p className="text-3xl font-semibold text-primary tabular-nums">
            {original ? value : <DigitGroup value={value} />}
          </p>
          {original ? (
            <div className="text-sm font-medium text-secondary">{sub}</div>
          ) : (
            <div className="inline-flex items-center gap-0.5 text-sm font-medium text-secondary">
              {sub}
              <ArrowUpRight
                className="size-3 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                strokeWidth={2}
              />
            </div>
          )}
        </div>
      </OverviewPanel>
    </>
  );
  return (
    <OverviewSection>
      {original ? (
        body
      ) : (
        <Link
          href={href}
          className="group flex flex-col gap-2 rounded-[12px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {body}
        </Link>
      )}
    </OverviewSection>
  );
}

function PaymentRow({ name, meta, amount }: { name: string; meta: string; amount: string }) {
  const original = useOriginalLook();
  const rowPad = useTweak("px-4 py-2.5", "px-4 py-3");
  return (
    <div className={cn("flex items-center justify-between gap-4", rowPad)}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={
            original
              ? "shrink-0 text-md font-medium text-primary"
              : "min-w-0 truncate text-md font-medium text-primary"
          }
        >
          {name}
        </span>
        <span
          className={
            original
              ? "truncate text-sm font-medium text-secondary"
              : "min-w-0 truncate text-sm font-medium text-secondary"
          }
        >
          {meta}
        </span>
      </div>
      <span className="shrink-0 text-md font-medium text-primary tabular-nums">{amount}</span>
    </div>
  );
}

function PapersPanel({
  issues,
  rowPad,
  showAll,
  plainRows,
  onViewAll,
  panelClassName,
  bodyRef,
}: {
  issues: Overview["papersPerIssue"];
  rowPad: string;
  showAll: boolean;
  plainRows: boolean;
  onViewAll: () => void;
  panelClassName?: string;
  bodyRef?: React.Ref<HTMLDivElement>;
}) {
  const visible = showAll ? issues : issues.slice(0, PAPERS_PREVIEW_COUNT);
  return (
    <OverviewPanel className={panelClassName}>
      <div ref={bodyRef}>
      {issues.length === 0 ? (
        <p className={cn(rowPad, "text-md font-medium text-secondary")}>
          No issues in this period yet.
        </p>
      ) : (
        <>
          {visible.map((issue) => (
            <div
              key={issue.issueId}
              className={cn("flex items-center justify-between gap-4", rowPad)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={
                    plainRows
                      ? "text-md font-medium text-primary"
                      : "min-w-0 truncate text-md font-medium text-primary"
                  }
                >
                  {issue.name.split(",")[0]}
                </span>
                <span
                  className={
                    plainRows
                      ? "text-sm font-medium text-secondary"
                      : "shrink-0 text-sm font-medium text-secondary"
                  }
                >
                  {formatIssueDate(issue.date)}
                </span>
              </div>
              <span className="shrink-0 text-md font-medium text-primary tabular-nums">
                {formatCount(issue.papers)}
              </span>
            </div>
          ))}
          {!showAll && issues.length > PAPERS_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onViewAll();
              }}
              className={cn(
                "inline-flex items-center gap-1 text-md font-medium text-primary",
                rowPad,
              )}
            >
              View all {issues.length} issues
              <ArrowRight className="size-3" strokeWidth={2} />
            </button>
          )}
        </>
      )}
      </div>
    </OverviewPanel>
  );
}

/**
 * Twelve buckets in the year's own month order, straight from the API. Which
 * month is current comes from the browser clock, so future bars can stay gray.
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

  const original = useOriginalLook();
  const axisMax = niceAxisMax(Math.max(...months.map((m) => m.amount), 0));
  const axisTicks = [axisMax, axisMax / 2, 0];
  const axisBox = useTweak("shrink-0 text-left", "w-10 shrink-0 text-right");
  const axisAnchor = useTweak("left-0", "right-0");
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" })
    .format(new Date())
    .slice(0, 7);
  const todayMonthIndex = original ? months.findIndex((month) => month.month === currentMonth) : -1;
  const todayLineLeft =
    todayMonthIndex >= 0 ? getTodayLineLeft(todayMonthIndex, months.length) : null;

  return (
    <div className="flex w-full items-start gap-2">
      <div
        className={cn(
          "relative text-sm font-medium text-secondary tabular-nums",
          axisBox,
        )}
        style={{ height: CHART_BAR_MAX_HEIGHT }}
      >
        {axisAnchor === "left-0" && (
          <span className="invisible flex w-max flex-col" aria-hidden>
            {axisTicks.map((tick) => (
              <span key={tick}>{formatAxisCurrency(tick)}</span>
            ))}
          </span>
        )}
        {axisTicks.map((tick) => (
          <span
            key={tick}
            className={cn("absolute -translate-y-1/2", axisAnchor)}
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

          <div
            className="absolute inset-0 z-[1] flex items-end"
            style={original ? { gap: CHART_BAR_GAP } : undefined}
          >
            {months.map((month, index) => {
              // Gray only means "hasn't happened." A past or current month at $0 is a real result.
              const isFuture = month.month > currentMonth;
              const isPlaceholder = month.amount === 0 && isFuture;
              const isZero = month.amount === 0;
              const height = Math.max((month.amount / axisMax) * 100, 8);
              const isHovered = hoveredBarIndex === index;
              const inset = original
                ? undefined
                : {
                    paddingLeft: index === 0 ? 0 : CHART_BAR_GAP / 2,
                    paddingRight: index === months.length - 1 ? 0 : CHART_BAR_GAP / 2,
                  };
              const barHeight = isZero ? 4 : `${height}%`;

              return (
                <div
                  key={month.month}
                  className="relative flex h-full min-w-0 flex-1 items-end"
                  style={inset}
                  onMouseEnter={() => handleHover(index)}
                  onMouseLeave={() => handleHover(null)}
                >
                  <div
                    className={
                      original
                        ? "relative w-full"
                        : "t-resize pointer-events-none relative w-full"
                    }
                    style={{ height: barHeight }}
                  >
                    {isHovered && !isPlaceholder && (
                      <div
                        className={
                          original
                            ? "absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-xs font-medium whitespace-nowrap text-bg"
                            : "absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 rounded-md bg-primary px-2 py-1 text-xs font-medium whitespace-nowrap text-bg tabular-nums"
                        }
                      >
                        {formatCurrency(month.amount)}
                      </div>
                    )}
                    <div
                      className={cn(
                        "h-full w-full rounded-t-[4px] transition-[background-color]",
                        original
                          ? "duration-200"
                          : "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                        isPlaceholder
                          ? "bg-chart-bar-empty"
                          : isHovered
                            ? "bg-chart-bar-hover"
                            : "bg-chart-bar",
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex" style={original ? { gap: CHART_BAR_GAP } : undefined}>
          {months.map((month, index) => (
            <span
              key={month.month}
              className="min-w-0 flex-1 text-center text-md font-medium text-primary"
              style={
                original
                  ? undefined
                  : {
                      paddingLeft: index === 0 ? 0 : CHART_BAR_GAP / 2,
                      paddingRight: index === months.length - 1 ? 0 : CHART_BAR_GAP / 2,
                    }
              }
            >
              {monthLabel(month.month)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function YearSwitcher({
  original = false,
  label,
  value,
  options,
  onSelect,
}: {
  original?: boolean;
  label: string;
  value: string;
  options: { id: string; label: string; archived: boolean }[];
  onSelect: (yearId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="text"
            size="sm"
            aria-label="Switch year"
            className={cn(
              "gap-1",
              original
                ? "-ml-1 px-1.5 font-medium"
                : "-ml-1.5 h-auto px-1.5 font-medium text-md text-secondary",
            )}
          />
        }
      >
        {original ? (
          <span className="text-md text-tertiary">{label}</span>
        ) : (
          <TextSwap text={label} className="text-md" />
        )}
        <ChevronDown
          className={cn("size-3.5", original ? "text-muted-foreground" : "text-secondary")}
          strokeWidth={2}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" sideOffset={4} className="min-w-56">
        <DropdownMenuRadioGroup value={value} onValueChange={onSelect}>
          {options.map((option) => {
            const isSelected = option.id === value;
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
  );
}

export default function OverviewPage() {
  const titlePad = useTweak("px-4", "px-2");
  const sectionTitle = useTweak(
    "text-md font-medium text-secondary",
    "text-md font-medium text-primary",
  );
  const lowerLayout = useTweak(
    "grid grid-cols-1 items-start gap-4 lg:grid-cols-2",
    "flex flex-col gap-7",
  );
  const sideBySide = lowerLayout.startsWith("grid");
  const isWide = React.useSyncExternalStore(subscribePairedWidth, pairedWidthSnapshot, () => false);
  const paired = sideBySide && isWide;
  const captainFrameRef = React.useRef<HTMLDivElement>(null);
  const papersFrameRef = React.useRef<HTMLDivElement>(null);
  const captainHeaderRef = React.useRef<HTMLDivElement>(null);
  const papersHeaderRef = React.useRef<HTMLHeadingElement>(null);
  const captainBodyRef = React.useRef<HTMLDivElement>(null);
  const papersBodyRef = React.useRef<HTMLDivElement>(null);
  const chartPad = useTweak("px-4 pt-9 pb-2.5", "px-4 py-5");
  const rowPad = useTweak("px-4 py-2.5", "px-4 py-3");
  const original = useOriginalLook();
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
  const yearTotal = overview
    ? overview.monthlyCosts.reduce((sum, month) => sum + month.amount, 0)
    : 0;
  const hoveredMonth =
    overview && hoveredChartIndex !== null
      ? overview.monthlyCosts[hoveredChartIndex]
      : undefined;

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
      if (captainMode === "custom") {
        setDraftStart(captainStart);
        setDraftEnd(captainEnd);
      } else if (!original && captainOverview) {
        setDraftStart(captainOverview.range.from);
        setDraftEnd(captainOverview.range.to);
      } else {
        setDraftStart("");
        setDraftEnd("");
      }
    }
    setPeriodOpen(next);
  }

  function applyCustomRange() {
    setCaptainStart(draftStart);
    setCaptainEnd(draftEnd);
    setCaptainMode("custom");
    setPeriodOpen(false);
  }

  function clearPeriodFilter() {
    setDraftStart("");
    setDraftEnd("");
    setCaptainStart("");
    setCaptainEnd("");
    setCaptainMode("ytd");
    setPeriodOpen(false);
  }

  const ytdRangeLabel = captainOverview
    ? `${monthYearLabel(captainOverview.range.from)} – ${monthYearLabel(captainOverview.range.to)}`
    : null;

  const papersPerIssue = overview?.papersPerIssue ?? [];
  const captainRows =
    (captainOverview?.captainPayments.length ?? 0) +
    (captainOverview?.substitutePayments.length ?? 0);

  React.useLayoutEffect(() => {
    const frames = [captainFrameRef.current, papersFrameRef.current];

    function clear() {
      for (const frame of frames) {
        if (frame) frame.style.height = "";
      }
    }

    const headers = [captainHeaderRef.current, papersHeaderRef.current];
    const bodies = [captainBodyRef.current, papersBodyRef.current];
    if (
      !paired ||
      frames.some((node) => !node) ||
      headers.some((node) => !node) ||
      bodies.some((node) => !node)
    ) {
      clear();
      return;
    }

    function naturalHeight(frame: HTMLElement, header: HTMLElement, body: HTMLElement) {
      const section = frame.firstElementChild as HTMLElement;
      const style = getComputedStyle(section);
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      let gap = columnGap(section);
      const headerParent = header.parentElement;
      if (headerParent && headerParent !== section) gap += columnGap(headerParent);
      return pad + gap + header.offsetHeight + body.offsetHeight;
    }

    let frameId = 0;
    function sync() {
      const captain = captainFrameRef.current;
      const papers = papersFrameRef.current;
      const captainHeader = captainHeaderRef.current;
      const papersHeader = papersHeaderRef.current;
      const captainBody = captainBodyRef.current;
      const papersBody = papersBodyRef.current;
      if (!captain || !papers || !captainHeader || !papersHeader || !captainBody || !papersBody) {
        return;
      }
      const next = Math.ceil(
        Math.min(
          naturalHeight(captain, captainHeader, captainBody),
          naturalHeight(papers, papersHeader, papersBody),
        ),
      );
      const px = `${next}px`;
      captain.style.height = px;
      papers.style.height = px;
    }

    sync();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(sync);
    });
    for (const node of [...headers, ...bodies]) {
      if (node) observer.observe(node);
    }
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      clear();
    };
  }, [paired, captainRows, papersPerIssue.length, captainMode]);

  return (
    <div className="page-container">
      <div className="page">
        <div className="flex h-full min-h-0 flex-col">
          {original ? (
            <PageBreadcrumb
              className="pr-[18px]"
              root="Overview"
              current={
                <YearSwitcher
                  original
                  label={selectedYearOption?.name ?? "…"}
                  value={activeYearId ?? ""}
                  options={yearOptions}
                  onSelect={handleSelectYear}
                />
              }
            />
          ) : (
            <div className="page-header-container">
              <div className="flex items-center gap-2">
                <h1 className="text-md text-primary">Overview</h1>
                <YearSwitcher
                  label={selectedYearOption?.name ?? "…"}
                  value={activeYearId ?? ""}
                  options={yearOptions}
                  onSelect={handleSelectYear}
                />
              </div>
            </div>
          )}
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
                    href="/labels"
                    value={formatCount(overview.stats.nextIssue?.papers ?? 0)}
                    sub={
                      overview.stats.nextIssue
                        ? `${overview.stats.nextIssue.name} • ${formatIssueDate(overview.stats.nextIssue.date)}`
                        : "No issue scheduled"
                    }
                  />
                  <StatCard
                    label="Active volunteers"
                    href="/members"
                    value={String(overview.stats.activeVolunteers)}
                    sub={`of ${overview.stats.totalVolunteers} total`}
                  />
                  <StatCard
                    label="Routes missing a carrier"
                    href="/routes"
                    value={String(overview.stats.routesMissingCarrier)}
                    sub={
                      original ? (
                        <Link
                          href="/routes"
                          className="inline-flex items-center gap-0.5 text-secondary transition-colors duration-150 hover:text-primary"
                        >
                          View routes
                          <ArrowUpRight className="size-3" strokeWidth={2} />
                        </Link>
                      ) : (
                        "View routes"
                      )
                    }
                  />
                  <StatCard
                    label="YTD captain costs"
                    href="/finances"
                    value={formatCurrency(overview.stats.captainCosts).replace(".00", "")}
                    sub={`${overview.stats.issueCount} ${overview.stats.issueCount === 1 ? "issue" : "issues"}`}
                  />
                </div>

                <OverviewSection>
                  {original ? (
                    <div className="flex items-center justify-between gap-4 px-2 text-md font-medium">
                      <h2 className="text-secondary">YTD Running Cost</h2>
                      <p className="text-secondary">
                        {hoveredMonth ? (
                          <>
                            {monthYearLabel(hoveredMonth.month)}{" "}
                            <span className="font-semibold text-primary">
                              {formatCurrency(hoveredMonth.amount)}
                            </span>
                          </>
                        ) : (
                          <>
                            {overview.year.name} total{" "}
                            <span className="font-semibold text-primary">
                              {formatCurrency(yearTotal)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <Link
                      href="/finances"
                      className="group flex flex-col gap-2 rounded-[12px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between gap-4 text-md font-medium",
                          titlePad,
                        )}
                      >
                        <h2 className="text-secondary transition-colors duration-150 group-hover:text-primary">
                          YTD Running Cost
                        </h2>
                        <p className="text-secondary">
                          <TextSwap
                            text={
                              hoveredMonth
                                ? monthLabel(hoveredMonth.month)
                                : `${overview.year.name} total`
                            }
                          />
                          {hoveredMonth ? (
                            <>
                              {" "}
                              <span className="font-semibold tabular-nums text-primary">
                                {formatCurrency(hoveredMonth.amount)}
                              </span>
                              {" out of "}
                            </>
                          ) : (
                            " "
                          )}
                          <DigitGroup
                            value={formatCurrency(yearTotal)}
                            className="font-semibold tabular-nums text-primary"
                          />
                        </p>
                      </div>

                      <OverviewPanel className={chartPad}>
                        <YtdRunningCostChart
                          months={overview.monthlyCosts}
                          onHover={setHoveredChartIndex}
                        />
                      </OverviewPanel>
                    </Link>
                  )}
                  {original && (
                    <OverviewPanel className={chartPad}>
                      <YtdRunningCostChart
                        months={overview.monthlyCosts}
                        onHover={setHoveredChartIndex}
                      />
                    </OverviewPanel>
                  )}
                </OverviewSection>

                <div className={lowerLayout}>
                <div ref={captainFrameRef}>
                <OverviewSection className={paired ? "h-full min-h-0 overflow-hidden" : undefined}>
                  <div
                    ref={captainHeaderRef}
                    className={cn(
                      paired && "shrink-0",
                      original
                        ? "flex flex-col gap-2 px-2"
                        : cn(
                            titlePad,
                            sideBySide
                              ? "flex items-center justify-between gap-3"
                              : "flex flex-col gap-2",
                          ),
                    )}
                  >
                    {original ? (
                      <h2 className="text-md font-medium text-primary">Captain Payments</h2>
                    ) : (
                      <Link
                        href="/finances"
                        className="group shrink-0 rounded-[4px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <h2
                          className={cn(
                            sectionTitle,
                            sideBySide && "shrink-0",
                            "transition-colors duration-150 group-hover:text-primary",
                          )}
                        >
                          Captain Payments
                        </h2>
                      </Link>
                    )}
                    <div
                      className={cn(
                        "flex items-center",
                        original
                          ? "justify-between gap-4"
                          : sideBySide
                            ? "min-w-0 flex-1 justify-end"
                            : "justify-end",
                      )}
                    >
                      {original && captainMode === "ytd" && (
                        <p className="min-w-0 flex-1 text-sm font-medium text-secondary">
                          {ytdRangeLabel ? `${ytdRangeLabel} (full year)` : null}
                        </p>
                      )}

                      <Popover open={periodOpen} onOpenChange={handlePeriodOpenChange}>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-[4px] px-2 text-sm font-medium text-primary transition-[background-color,scale] duration-150 ease-out hover:scale-[0.98] hover:bg-bg-tertiary active:scale-[0.97] data-popup-open:bg-bg-quaternary data-popup-open:hover:scale-100 data-popup-open:active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
                                original ? "py-1" : "-mr-2 py-0",
                              )}
                            >
                              {original ? periodLabel : <TextSwap text={periodLabel} />}
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
                          {original ? (
                            <>
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
                                      max={draftEnd}
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
                                      min={draftStart}
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
                            </>
                          ) : (
                            <div className="flex flex-col gap-2 px-1.5 pt-1 pb-1.5">
                              <div className="flex items-end gap-2">
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <p className="px-1 text-sm font-medium text-secondary">Start</p>
                                  <DatePicker
                                    label="Start"
                                    value={draftStart}
                                    onChange={setDraftStart}
                                    max={draftEnd}
                                  />
                                </div>
                                <span
                                  aria-hidden
                                  className="flex h-8 shrink-0 items-center text-sm text-muted-foreground"
                                >
                                  →
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <p className="px-1 text-sm font-medium text-secondary">End</p>
                                  <DatePicker
                                    label="End"
                                    value={draftEnd}
                                    onChange={setDraftEnd}
                                    min={draftStart}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="text"
                                  size="sm"
                                  disabled={!draftStart && !draftEnd && captainMode !== "custom"}
                                  onClick={clearPeriodFilter}
                                >
                                  Clear
                                </Button>
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
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {original ? (
                  <OverviewPanel>
                    <div>
                      {(captainOverview?.captainPayments.length ?? 0) === 0 &&
                      (captainOverview?.substitutePayments.length ?? 0) === 0 ? (
                        <p className={cn(rowPad, "text-md font-medium text-secondary")}>
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
                    </div>
                  </OverviewPanel>
                  ) : (
                  <Link
                    href="/finances"
                    className={cn(
                      "rounded-[16px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      paired && "flex min-h-0 flex-1 flex-col",
                    )}
                  >
                  <OverviewPanel className={paired ? pairedScroll : undefined}>
                    <div ref={captainBodyRef}>
                      {(captainOverview?.captainPayments.length ?? 0) === 0 &&
                      (captainOverview?.substitutePayments.length ?? 0) === 0 ? (
                        <p className={cn(rowPad, "text-md font-medium text-secondary")}>
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
                    </div>
                  </OverviewPanel>
                  </Link>
                  )}
                </OverviewSection>
                </div>

                <div ref={papersFrameRef}>
                <OverviewSection className={paired ? "h-full min-h-0 overflow-hidden" : undefined}>
                  {original ? (
                    <>
                      <h2 className="px-2 text-md font-medium text-primary">Papers Per Issue</h2>
                      <PapersPanel
                        issues={papersPerIssue}
                        rowPad={rowPad}
                        showAll={false}
                        plainRows
                        onViewAll={() => setPapersDialogOpen(true)}
                      />
                    </>
                  ) : (
                    <Link
                      href="/labels"
                      className={cn(
                        "group flex flex-col gap-2 rounded-[12px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        paired && "h-full min-h-0",
                      )}
                    >
                      <h2
                        ref={papersHeaderRef}
                        className={cn(
                          sectionTitle,
                          titlePad,
                          sideBySide && "shrink-0",
                          "transition-colors duration-150 group-hover:text-primary",
                        )}
                      >
                        Papers Per Issue
                      </h2>
                      <PapersPanel
                        issues={papersPerIssue}
                        rowPad={rowPad}
                        showAll={sideBySide}
                        plainRows={false}
                        onViewAll={() => setPapersDialogOpen(true)}
                        panelClassName={paired ? pairedScroll : undefined}
                        bodyRef={papersBodyRef}
                      />
                    </Link>
                  )}
                </OverviewSection>
                </div>
                </div>
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
