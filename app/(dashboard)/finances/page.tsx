"use client";

import * as React from "react";
import { ChevronDown, Filter, MoreHorizontal, Plus, X } from "lucide-react";

import { PaymentCell } from "@/components/payment-cell";
import { ArchiveBanner } from "@/components/archive-banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  useAddIssue,
  useArchiveYear,
  useCreateYear,
  useMarkPaid,
  useOverridePayout,
  useRenameYear,
  useSetCellComment,
  useSetSubstitute,
  useToggleIssueLock,
  useYearDetail,
  useYears,
  yearCsvUrl,
  type GridIssue,
} from "@/features/finances/api";

import {
  DEFAULT_FINANCES_FILTERS,
  NO_SUBSTITUTE,
  filterFinancesCaptains,
  filterFinancesIssues,
  formatCurrency,
  formatIssueDateLong,
  yearDateRange,
  type CellKey,
  type CellOverride,
  type FinancesFilterState,
  type IssueFilterValue,
  type PaymentFilterValue,
} from "./data";

/** Fixed column widths — table-layout:fixed; checking cells must not resize columns */
const ISSUE_COLUMN_WIDTH = 232;
const CAPTAIN_COLUMN_WIDTH = 133;

const FINANCES_TABLE_CELL = "border-[0.5px] border-border";

function OpenLockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-3"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function ClosedLockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-3"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

type FilterSegmentOption<T extends string> = {
  value: T;
  label: string;
};

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-primary">{label}</p>
      {children}
    </div>
  );
}

function FilterSegmentGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: FilterSegmentOption<T>[];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<Partial<Record<string, HTMLButtonElement>>>({});
  const [indicator, setIndicator] = React.useState({ left: 0, width: 0 });

  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current;
    const button = buttonRefs.current[value];
    if (!container || !button) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    setIndicator({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    });
  }, [value]);

  React.useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, options]);

  React.useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  return (
    <div ref={containerRef} className="relative flex rounded-full bg-[#F3F4F6] p-1">
      <div
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-bg transition-[left,width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            ref={(element) => {
              if (element) buttonRefs.current[option.value] = element;
              else delete buttonRefs.current[option.value];
            }}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex-1 rounded-full px-2 py-1 text-sm transition-colors",
              isSelected ? "font-medium text-primary" : "text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FinancesPage() {
  const [selectedYearId, setSelectedYearId] = React.useState<string | null>(null);
  const [draftIssue, setDraftIssue] = React.useState<{ label: string } | null>(null);
  const [editingCell, setEditingCell] = React.useState<CellKey | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [confirmDialog, setConfirmDialog] = React.useState<{
    key: CellKey;
    value: string;
    originalValue: number;
  } | null>(null);
  const [overrideNote, setOverrideNote] = React.useState("");
  const [flashTriggers, setFlashTriggers] = React.useState<Partial<Record<CellKey, number>>>({});
  const [filters, setFilters] = React.useState<FinancesFilterState>(DEFAULT_FINANCES_FILTERS);
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const [createTableOpen, setCreateTableOpen] = React.useState(false);
  const [newTableName, setNewTableName] = React.useState("");
  const [showArchiveBanner, setShowArchiveBanner] = React.useState(false);
  const [isEditingTableTitle, setIsEditingTableTitle] = React.useState(false);
  const [tableTitleEditValue, setTableTitleEditValue] = React.useState("");

  const { data: years } = useYears();
  // Default to the newest non-archived year, matching what the overview picks.
  const defaultYear = years?.find((y) => !y.archived) ?? years?.[0];
  const activeYearId = selectedYearId ?? defaultYear?.id ?? null;

  const { data: year, isPending, isError, error } = useYearDetail(activeYearId);

  const createYear = useCreateYear();
  const renameYear = useRenameYear();
  const archiveYear = useArchiveYear();
  const addIssue = useAddIssue(activeYearId);
  const toggleLock = useToggleIssueLock(activeYearId);
  const overridePayout = useOverridePayout(activeYearId);
  const markPaid = useMarkPaid(activeYearId);
  const setSubstitute = useSetSubstitute(activeYearId);
  const setCellComment = useSetCellComment(activeYearId);

  const tableOptions = (years ?? []).map((y) => ({
    id: y.id,
    label: y.archived ? `${y.name} (archived)` : y.name,
    archived: y.archived,
  }));
  const selectedTable = tableOptions.find((o) => o.id === activeYearId) ?? tableOptions[0];
  const tableDisplayLabel = year?.name ?? selectedTable?.label ?? "";
  const isArchivedYear = year?.archived ?? false;
  const archivedYearDateRange = isArchivedYear && year ? yearDateRange(year.startDate) : null;

  // Memoised so the `?? []` fallbacks do not produce a new array identity on every
  // render, which would make every downstream memo recompute for nothing.
  const allCaptains = React.useMemo(() => year?.captains ?? [], [year]);
  const allIssues = React.useMemo<GridIssue[]>(() => year?.issues ?? [], [year]);

  const visibleCaptains = React.useMemo(
    () => filterFinancesCaptains(allCaptains, filters),
    [allCaptains, filters],
  );
  const visibleCaptainIds = React.useMemo(
    () => visibleCaptains.map((c) => c.id),
    [visibleCaptains],
  );
  const visibleIssues = React.useMemo(
    () => filterFinancesIssues(allIssues, filters, visibleCaptainIds),
    [allIssues, filters, visibleCaptainIds],
  );
  const isEmptyTable = allIssues.length === 0 && !draftIssue;

  /** Every cell keyed by payout id, so lookups do not walk the grid each render. */
  const cellsByPayoutId = React.useMemo(() => {
    const map = new Map<string, GridIssue["cells"][number]>();
    for (const issue of allIssues) for (const cell of issue.cells) map.set(cell.payoutId, cell);
    return map;
  }, [allIssues]);

  /**
   * Who can be picked as a substitute: every captain with a column, plus "None".
   * PENDING(Q6) — the backend allows one person to cover several captains, so this
   * is not capped; the design just shows one covered name per line.
   */
  const substituteOptions = React.useMemo(
    () => [NO_SUBSTITUTE, ...allCaptains.map((c) => c.name)],
    [allCaptains],
  );

  function updateFilters(patch: Partial<FinancesFilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggleCaptainFilter(captainId: string, checked: boolean) {
    setFilters((prev) => ({
      ...prev,
      captains: checked
        ? [...prev.captains, captainId]
        : prev.captains.filter((id) => id !== captainId),
    }));
  }

  function handleSelectTable(tableId: string) {
    setSelectedYearId(tableId);
    setEditingCell(null);
    setDraftIssue(null);
    const next = tableOptions.find((o) => o.id === tableId);
    setShowArchiveBanner(next?.archived ?? false);
  }

  function handleArchiveTable() {
    if (!activeYearId || isArchivedYear) return;
    setOverflowOpen(false);
    archiveYear.mutate(activeYearId, { onSuccess: () => setShowArchiveBanner(true) });
  }

  function openCreateTableDialog() {
    setOverflowOpen(false);
    setNewTableName("");
    setCreateTableOpen(true);
  }

  function closeCreateTableDialog() {
    setCreateTableOpen(false);
    setNewTableName("");
  }

  function handleCreateTable() {
    const name = newTableName.trim();
    if (!name) return;
    // The start date sets the reporting quarters. There is no field for it in the
    // design, so a new table starts on the first of the current month, which is
    // the least surprising default for "I am starting a year now".
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    createYear.mutate(
      { name, startDate },
      {
        onSuccess: (created) => {
          setSelectedYearId(created.id);
          setShowArchiveBanner(false);
          closeCreateTableDialog();
        },
      },
    );
  }

  function startTableTitleEdit() {
    if (isArchivedYear || !year) return;
    setTableTitleEditValue(year.name);
    setIsEditingTableTitle(true);
  }

  function cancelTableTitleEdit() {
    setIsEditingTableTitle(false);
    setTableTitleEditValue("");
  }

  function commitTableTitleEdit() {
    const name = tableTitleEditValue.trim();
    if (!activeYearId || !name || name === year?.name) return cancelTableTitleEdit();
    renameYear.mutate({ yearId: activeYearId, name }, { onSettled: cancelTableTitleEdit });
  }

  function handleTableTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTableTitleEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelTableTitleEdit();
    }
  }

  function handleCommentChange(key: CellKey, comment: string) {
    setCellComment.mutate({ payoutId: key, comment: comment.trim() || null });
  }

  /**
   * PENDING(Q6). The picker offers every other captain plus "None". Choosing the
   * column's own captain clears the substitute, since a captain covering for
   * themselves is the same as nobody covering.
   */
  function handleSubstituteChange(key: CellKey, columnCaptainId: string, nextName: string) {
    const target = allCaptains.find((c) => c.name === nextName);
    const substituteCaptainId =
      nextName === NO_SUBSTITUTE || !target || target.id === columnCaptainId ? null : target.id;
    setSubstitute.mutate({ payoutId: key, substituteCaptainId });
  }

  /** PENDING(Q2 / Q3): allowed on an open issue, and there is no untick in the UI. */
  function handleMarkPaid(key: CellKey) {
    if (isArchivedYear) return;
    markPaid.mutate(key);
  }

  function handleDoubleClick(key: CellKey) {
    if (isArchivedYear) return;
    const cell = cellsByPayoutId.get(key);
    if (!cell || cell.paid) return;
    setEditingCell(key);
    setEditValue(String(cell.effectiveAmount));
  }

  function handleEditSubmit(key: CellKey) {
    const cell = cellsByPayoutId.get(key);
    if (!cell) return setEditingCell(null);

    const parsed = parseFloat(editValue);
    if (Number.isNaN(parsed) || parsed < 0) return setEditingCell(null);

    // Typing the calculated value back in means "no override", so clear instead.
    if (parsed === cell.effectiveAmount) return setEditingCell(null);

    setEditingCell(null);
    setOverrideNote("");
    setConfirmDialog({ key, value: String(parsed), originalValue: cell.effectiveAmount });
  }

  function closeConfirmDialog() {
    setConfirmDialog(null);
    setOverrideNote("");
  }

  function confirmEdit() {
    if (!confirmDialog) return;
    const note = overrideNote.trim();
    if (!note) return;

    const { key, value } = confirmDialog;
    overridePayout.mutate(
      { payoutId: key, amount: parseFloat(value), reason: note },
      {
        onSuccess: () => {
          setFlashTriggers((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
        },
      },
    );
    closeConfirmDialog();
  }

  function handleAddIssue() {
    if (isArchivedYear || draftIssue) return;
    setDraftIssue({ label: "" });
  }

  function commitDraftIssue() {
    const label = draftIssue?.label.trim();
    setDraftIssue(null);
    if (!label || !activeYearId) return;
    // No date field in the design, so a new issue is dated today. Its position in
    // the year (and so its reporting quarter) follows from that.
    const today = new Date().toISOString().slice(0, 10);
    addIssue.mutate({ name: label, date: today });
  }

  function handleDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraftIssue();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraftIssue(null);
    }
  }

  function handleDraftBlur() {
    commitDraftIssue();
  }

  /** PENDING(Q1): one lock per issue, applied as a bulk freeze over its cells. */
  function toggleIssueLock(issueId: string, locked: boolean) {
    if (isArchivedYear) return;
    if (editingCell && cellsByPayoutId.get(editingCell)?.payoutId) setEditingCell(null);
    toggleLock.mutate({ issueId, locked });
  }

  function handleExportCsv() {
    if (activeYearId) window.location.href = yearCsvUrl(activeYearId);
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="page">
          <p className="p-6 text-md text-secondary">
            {error instanceof Error ? error.message : "Could not load this finance table."}
          </p>
        </div>
      </div>
    );
  }

  if (isPending || !year) {
    return (
      <div className="page-container">
        <div className="page">
          <p className="p-6 text-md text-secondary">Loading finance table…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="page-container">
      <div className="page">
        <div className="flex flex-col gap-4 p-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* Same as Overview: the breadcrumb's first segment is the page's
                  only title, so it carries the h1. Classes unchanged. */}
              <h1 className="text-md text-muted-foreground">Finances</h1>
              <span className="text-md text-muted-foreground">/</span>
              <div className="inline-flex items-center gap-1">
                {isEditingTableTitle ? (
                  <span className="inline-grid items-center [&>*]:col-start-1 [&>*]:row-start-1">
                    <span aria-hidden className="invisible whitespace-pre px-0 text-md font-medium">
                      {tableTitleEditValue || tableDisplayLabel}
                    </span>
                    <input
                      autoFocus
                      value={tableTitleEditValue}
                      onChange={(event) => setTableTitleEditValue(event.target.value)}
                      onKeyDown={handleTableTitleKeyDown}
                      onBlur={cancelTableTitleEdit}
                      onFocus={(event) => event.target.select()}
                      aria-label="Table name"
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-md font-medium text-primary outline outline-2 outline-active -outline-offset-2"
                    />
                  </span>
                ) : (
                  <span
                    onDoubleClick={startTableTitleEdit}
                    className={cn(
                      "text-md font-medium text-primary",
                      !isArchivedYear && "cursor-text",
                    )}
                  >
                    {tableDisplayLabel}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Switch table"
                        className="inline-flex items-center text-muted-foreground"
                      >
                        <ChevronDown className="size-3.5" strokeWidth={2} />
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
                      onValueChange={handleSelectTable}
                    >
                      {tableOptions.map((option) => {
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

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleExportCsv}>
                Export as CSV
              </Button>
              <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="More actions"
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color] duration-300 ease-out",
                        "hover:bg-muted hover:text-primary",
                        "data-popup-open:bg-muted data-popup-open:text-primary data-popup-open:hover:bg-muted data-popup-open:hover:text-primary",
                      )}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  }
                />
                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={4}
                  className="w-auto min-w-0 gap-0 rounded-lg p-1 shadow-md ring-1 ring-foreground/10"
                >
                  {!isArchivedYear && (
                    <button
                      type="button"
                      onClick={handleArchiveTable}
                      className="flex w-full rounded-md px-3 py-1.5 text-left text-sm text-primary hover:bg-tag-hover active:bg-secondary-fill-hover"
                    >
                      Archive table
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openCreateTableDialog}
                    className="flex w-full rounded-md px-3 py-1.5 text-left text-sm text-primary hover:bg-tag-hover active:bg-secondary-fill-hover"
                  >
                    Create new table
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {showArchiveBanner && archivedYearDateRange && (
            <ArchiveBanner
              dateRange={archivedYearDateRange}
              onDismiss={() => setShowArchiveBanner(false)}
            />
          )}

          {/* Filter + table */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Filter"
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-[8px] border-[0.5px] border-border bg-bg text-muted-foreground transition-[background-color,color,border-color] duration-300 ease-out",
                        "hover:border-transparent hover:bg-muted hover:text-primary",
                        "data-popup-open:border-transparent data-popup-open:bg-muted data-popup-open:text-primary data-popup-open:hover:bg-muted data-popup-open:hover:text-primary",
                      )}
                    >
                      <Filter className="size-4" strokeWidth={1.5} />
                    </button>
                  }
                />
                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={4}
                  className="w-[280px] gap-4 rounded-xl bg-bg p-4 text-md text-primary shadow-md ring-1 ring-foreground/10"
                >
                  <p className="text-md font-medium text-primary">Filters</p>

                  <FilterSection label="Issue">
                    <FilterSegmentGroup<IssueFilterValue>
                      value={filters.issue}
                      onChange={(issue) => updateFilters({ issue })}
                      options={[
                        { value: "all", label: "All" },
                        { value: "open", label: "Open" },
                        { value: "closed", label: "Closed" },
                      ]}
                    />
                  </FilterSection>

                  <FilterSection label="Payment">
                    <FilterSegmentGroup<PaymentFilterValue>
                      value={filters.payment}
                      onChange={(payment) => updateFilters({ payment })}
                      options={[
                        { value: "all", label: "All" },
                        { value: "paid", label: "Paid" },
                        { value: "unpaid", label: "Unpaid" },
                      ]}
                    />
                  </FilterSection>

                  <FilterSection label="Date">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <DatePicker
                          label="Start Date"
                          value={filters.startDate}
                          onChange={(startDate) => updateFilters({ startDate })}
                        />
                      </div>
                      <span aria-hidden className="shrink-0 text-sm text-muted-foreground">
                        →
                      </span>
                      <div className="min-w-0 flex-1">
                        <DatePicker
                          label="End Date"
                          value={filters.endDate}
                          onChange={(endDate) => updateFilters({ endDate })}
                        />
                      </div>
                    </div>
                  </FilterSection>

                  <div className="border-t border-border" />

                  <FilterSection label="Captain">
                    <div className="flex flex-col gap-2">
                      {allCaptains.map((captain) => {
                        const checked = filters.captains.includes(captain.id);

                        return (
                          <label
                            key={captain.id}
                            className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) =>
                                toggleCaptainFilter(captain.id, nextChecked)
                              }
                              className="border-border bg-bg data-checked:border-primary data-checked:bg-primary data-checked:text-bg"
                            />
                            {captain.name}
                          </label>
                        );
                      })}
                    </div>
                  </FilterSection>
                </PopoverContent>
              </Popover>
            </div>

            <div className="overflow-hidden bg-bg">
              <Table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: ISSUE_COLUMN_WIDTH }} />
                  {visibleCaptains.map((captain) => (
                    <col key={captain.id} style={{ width: CAPTAIN_COLUMN_WIDTH }} />
                  ))}
                </colgroup>
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead
                      className={cn(
                        "h-10 px-4 text-sm font-medium text-muted-foreground",
                        FINANCES_TABLE_CELL,
                      )}
                      style={{ width: ISSUE_COLUMN_WIDTH, minWidth: ISSUE_COLUMN_WIDTH }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Issue</span>
                        {!isEmptyTable && !isArchivedYear && (
                          <Button
                            type="button"
                            variant="text"
                            size="icon-xs"
                            aria-label="Add issue"
                            disabled={!!draftIssue}
                            onClick={handleAddIssue}
                            className="size-6 shrink-0 text-muted-foreground hover:text-primary"
                          >
                            <Plus className="size-3.5" strokeWidth={1.5} />
                          </Button>
                        )}
                      </div>
                    </TableHead>
                    {visibleCaptains.map((captain) => (
                      <TableHead
                        key={captain.id}
                        className={cn(
                          "h-10 px-4 text-sm font-medium text-muted-foreground",
                          FINANCES_TABLE_CELL,
                        )}
                        style={{ width: CAPTAIN_COLUMN_WIDTH, minWidth: CAPTAIN_COLUMN_WIDTH }}
                      >
                        {captain.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-0">
                  {isEmptyTable && !isArchivedYear && (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell
                        className={cn("px-4 py-3", FINANCES_TABLE_CELL)}
                        style={{ width: ISSUE_COLUMN_WIDTH, minWidth: ISSUE_COLUMN_WIDTH }}
                      >
                        <Button type="button" variant="outline" size="sm" onClick={handleAddIssue}>
                          Add Issue
                        </Button>
                      </TableCell>
                      {visibleCaptains.map((captain) => (
                        <TableCell
                          key={`empty-${captain.id}`}
                          className={cn("h-12", FINANCES_TABLE_CELL)}
                          style={{ width: CAPTAIN_COLUMN_WIDTH, minWidth: CAPTAIN_COLUMN_WIDTH }}
                        />
                      ))}
                    </TableRow>
                  )}
                  {draftIssue && (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell
                        className={cn(
                          "relative z-10 px-4 py-3 outline outline-2 outline-active -outline-offset-2",
                          FINANCES_TABLE_CELL,
                        )}
                        style={{ width: ISSUE_COLUMN_WIDTH, minWidth: ISSUE_COLUMN_WIDTH }}
                      >
                        <input
                          autoFocus
                          placeholder="Issue Name"
                          value={draftIssue.label}
                          onChange={(e) => setDraftIssue({ label: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onBlur={handleDraftBlur}
                          aria-label="Issue name"
                          className="w-full border-0 bg-transparent p-0 text-md text-primary outline-none placeholder:text-muted-foreground"
                        />
                      </TableCell>
                      {visibleCaptains.map((captain) => (
                        <TableCell
                          key={`draft-${captain.id}`}
                          className={cn("h-12", FINANCES_TABLE_CELL)}
                          style={{ width: CAPTAIN_COLUMN_WIDTH, minWidth: CAPTAIN_COLUMN_WIDTH }}
                        />
                      ))}
                    </TableRow>
                  )}
                  {visibleIssues.map((issue) => {
                    const isIssueLocked = issue.locked;

                    return (
                      <TableRow key={issue.id} className="border-0 hover:bg-transparent">
                        <TableCell
                          className={cn("h-12 p-2 text-md text-primary", FINANCES_TABLE_CELL)}
                          style={{ width: ISSUE_COLUMN_WIDTH, minWidth: ISSUE_COLUMN_WIDTH }}
                        >
                          <div className="group flex h-full w-full items-center justify-between gap-2">
                            {/* The office already names issues with their date
                                ("Issue 01, March 10th"), so appending the date
                                again would read as a duplicate. */}
                            <span className="min-w-0 whitespace-nowrap">{issue.name}</span>
                            {!isArchivedYear && (
                              <button
                                type="button"
                                aria-label={isIssueLocked ? "Unlock issue" : "Lock issue"}
                                onClick={() => toggleIssueLock(issue.id, isIssueLocked)}
                                className={cn(
                                  "flex shrink-0 items-center justify-center rounded-[4px] p-1.5 text-muted-foreground transition-[opacity,background-color,color] duration-200 hover:bg-muted hover:text-primary",
                                  isIssueLocked
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100",
                                )}
                              >
                                {isIssueLocked ? <ClosedLockIcon /> : <OpenLockIcon />}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        {visibleCaptains.map((captain) => {
                          const cell = issue.cells.find((c) => c.captainId === captain.id);
                          if (!cell) {
                            return (
                              <TableCell
                                key={`${issue.id}-${captain.id}`}
                                className={cn("h-12", FINANCES_TABLE_CELL)}
                                style={{
                                  width: CAPTAIN_COLUMN_WIDTH,
                                  minWidth: CAPTAIN_COLUMN_WIDTH,
                                }}
                              />
                            );
                          }

                          const key: CellKey = cell.payoutId;
                          const isEditing = editingCell === key;
                          const overridden = cell.calculationStatus === "overridden";
                          const override: CellOverride | undefined = overridden
                            ? {
                                amount: cell.effectiveAmount,
                                originalValue: cell.calculatedAmount,
                                note: cell.overrideReason ?? "",
                              }
                            : undefined;
                          // Quantity implied by the formula, so the popover can show
                          // "N x rate" without a request per cell.
                          const quantity =
                            captain.payRate > 0
                              ? Math.round(cell.calculatedAmount / captain.payRate)
                              : 0;

                          return (
                            <TableCell
                              key={key}
                              className={cn("p-0", FINANCES_TABLE_CELL)}
                              style={{
                                width: CAPTAIN_COLUMN_WIDTH,
                                minWidth: CAPTAIN_COLUMN_WIDTH,
                              }}
                            >
                              <PaymentCell
                                value={cell.effectiveAmount}
                                paid={cell.paid}
                                columnCaptain={captain.name}
                                substituteCaptain={cell.substituteCaptainName ?? NO_SUBSTITUTE}
                                substituteOptions={substituteOptions}
                                onSubstituteChange={(nextName) =>
                                  handleSubstituteChange(key, captain.id, nextName)
                                }
                                paymentDetail={{
                                  captainName: captain.name,
                                  issueLabel: issue.name,
                                  lastModified: formatIssueDateLong(issue.date),
                                  territory: `${captain.name}'s territory`,
                                  bundleCount: quantity,
                                  ratePerBundle: captain.payRate,
                                }}
                                comment={cell.comment ?? undefined}
                                onCommentChange={(nextComment) =>
                                  handleCommentChange(key, nextComment)
                                }
                                overridden={overridden}
                                override={override}
                                flashTrigger={flashTriggers[key] ?? 0}
                                onMarkPaid={() => handleMarkPaid(key)}
                                isEditing={isEditing}
                                editValue={editValue}
                                onEditValueChange={setEditValue}
                                onEditSubmit={() => handleEditSubmit(key)}
                                onEditCancel={() => setEditingCell(null)}
                                onDoubleClick={() => handleDoubleClick(key)}
                                readOnly={isArchivedYear}
                                isLocked={isIssueLocked}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <Dialog open={createTableOpen} onOpenChange={(open) => !open && closeCreateTableDialog()}>
            <DialogContent className="gap-6 border-hairline p-5">
              <div className="flex flex-col gap-4">
                <DialogTitle className="text-md font-normal text-primary">
                  New Finance Table
                </DialogTitle>

                <Input
                  placeholder="2027 Payments"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateTable();
                    }
                  }}
                  aria-label="Finance table name"
                  className="h-auto rounded-lg border-hairline bg-bg px-3 py-2 text-md"
                />
              </div>

              <DialogFooter className="mt-0 gap-4">
                <Button type="button" variant="outline" onClick={closeCreateTableDialog}>
                  Cancel
                </Button>
                <Button type="button" disabled={!newTableName.trim()} onClick={handleCreateTable}>
                  Create Table
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && closeConfirmDialog()}>
            <DialogContent className="gap-0 overflow-hidden p-0">
              <DialogHeader className="mb-0 flex-row items-start justify-between gap-4 border-b border-border px-6 py-4">
                <DialogTitle className="text-md font-medium leading-snug">
                  Leave a note to override{" "}
                  {confirmDialog
                    ? `${formatCurrency(confirmDialog.originalValue)} to ${formatCurrency(parseFloat(confirmDialog.value))}`
                    : ""}
                </DialogTitle>
                <Button
                  type="button"
                  variant="text"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  onClick={closeConfirmDialog}
                >
                  <X className="size-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogHeader>

              <div className="flex flex-col gap-3 px-6 py-4">
                <DialogDescription className="text-md text-primary">
                  This will replace the calculated value with a manual entry.
                </DialogDescription>
                <Textarea
                  placeholder="Enter a description..."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  aria-label="Override note"
                />
              </div>

              <DialogFooter className="mt-0 gap-2 border-t border-border px-6 py-4">
                <Button type="button" variant="outline" onClick={closeConfirmDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={!overrideNote.trim()}
                  onClick={confirmEdit}
                >
                  Override
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
