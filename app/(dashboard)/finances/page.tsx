"use client";

import * as React from "react";
import { ChevronDown, Filter, MoreHorizontal, Plus } from "lucide-react";

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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogField,
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
  CAPTAINS,
  DEFAULT_FINANCES_FILTERS,
  INITIAL_ISSUES,
  createCustomTableId,
  createEmptyCustomTable,
  createFinanceTableOptions,
  filterFinancesCaptains,
  filterFinancesIssues,
  getPaymentDetail,
  getPaymentYearTable,
  PAYMENT_YEAR_DATE_RANGES,
  type CaptainName,
  type CellKey,
  type CellOverride,
  type CustomFinanceTable,
  type FinanceTableOption,
  type FinancesFilterState,
  type Issue,
  type IssueFilterValue,
  type PaymentFilterValue,
  type PaymentYear,
  type SubstituteCaptainAssignment,
  type SubstituteCaptainName,
  formatCurrency,
  generatePaymentsForIssueAtIndex,
  generatePaymentsForIssues,
  initialCellComments,
  initialPaidCells,
  nextIssueId,
} from "./data";

/** Fixed column widths — table-layout:fixed; checking cells must not resize columns */
const ISSUE_COLUMN_WIDTH = 232;
const CAPTAIN_COLUMN_WIDTH = 133;

const FINANCES_TABLE_CELL = "border-[0.5px] border-border";

function getTableDisplayLabel(label: string) {
  return label.replace(" (archived)", "");
}

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
      <p className="text-sm text-primary">{label}</p>
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
    <div ref={containerRef} className="relative flex gap-1 rounded-lg bg-[#F3F4F6] p-1">
      <div
        aria-hidden
        className="absolute top-1 bottom-1 rounded-[4px] bg-bg transition-[left,width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((option) => (
          <button
            key={option.value}
            ref={(element) => {
              if (element) buttonRefs.current[option.value] = element;
              else delete buttonRefs.current[option.value];
            }}
            type="button"
            onClick={() => onChange(option.value)}
            className="relative z-10 flex-1 rounded-[4px] px-3 py-[7px] text-center text-sm text-primary transition-colors"
          >
            {option.label}
          </button>
        ))}
    </div>
  );
}

export default function FinancesPage() {
  const [tableOptions, setTableOptions] = React.useState<FinanceTableOption[]>(() =>
    createFinanceTableOptions(),
  );
  const [customTables, setCustomTables] = React.useState<Record<string, CustomFinanceTable>>({});
  const [selectedTableId, setSelectedTableId] = React.useState("2026");
  const [issues, setIssues] = React.useState<Issue[]>(() => [...INITIAL_ISSUES]);
  const [payments, setPayments] = React.useState(() => generatePaymentsForIssues(INITIAL_ISSUES));
  const [paid, setPaid] = React.useState<Set<CellKey>>(initialPaidCells);
  const [draftIssue, setDraftIssue] = React.useState<{ label: string } | null>(null);
  const [editingCell, setEditingCell] = React.useState<CellKey | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [confirmDialog, setConfirmDialog] = React.useState<{
    key: CellKey;
    value: string;
    originalValue: number;
  } | null>(null);
  const [overrideNote, setOverrideNote] = React.useState("");
  const [editedCells, setEditedCells] = React.useState<Record<CellKey, CellOverride>>({});
  const [substitutes, setSubstitutes] = React.useState<
    Partial<Record<CellKey, SubstituteCaptainName>>
  >({});
  const [cellComments, setCellComments] = React.useState<Partial<Record<CellKey, string>>>(() =>
    initialCellComments(),
  );
  const [flashTriggers, setFlashTriggers] = React.useState<Partial<Record<CellKey, number>>>({});
  const [filters, setFilters] = React.useState<FinancesFilterState>(DEFAULT_FINANCES_FILTERS);
  const [draftFilters, setDraftFilters] =
    React.useState<FinancesFilterState>(DEFAULT_FINANCES_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const filterButtonRef = React.useRef<HTMLButtonElement>(null);
  const filterPanelRef = React.useRef<HTMLDivElement>(null);
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const [createTableOpen, setCreateTableOpen] = React.useState(false);
  const [newTableName, setNewTableName] = React.useState("");
  const [showArchiveBanner, setShowArchiveBanner] = React.useState(false);
  const [isEditingTableTitle, setIsEditingTableTitle] = React.useState(false);
  const [tableTitleEditValue, setTableTitleEditValue] = React.useState("");
  const [lockedIssues, setLockedIssues] = React.useState<Set<number>>(() => new Set());

  const selectedTable =
    tableOptions.find((option) => option.id === selectedTableId) ?? tableOptions[0];
  const tableDisplayLabel = getTableDisplayLabel(selectedTable.label);
  const isArchivedYear = selectedTable?.archived ?? false;
  const isEmptyTable = issues.length === 0 && !draftIssue;
  const archivedYearDateRange = isArchivedYear
    ? selectedTableId.startsWith("custom:")
      ? selectedTable.label.replace(" (archived)", "")
      : PAYMENT_YEAR_DATE_RANGES[Number(selectedTableId) as PaymentYear]
    : null;

  const visibleCaptains = React.useMemo(() => filterFinancesCaptains(filters), [filters]);
  const visibleIssues = React.useMemo(
    () => filterFinancesIssues(issues, filters, paid),
    [issues, filters, paid],
  );

  React.useEffect(() => {
    if (!filtersOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (filterPanelRef.current?.contains(target)) return;
      if (filterButtonRef.current?.contains(target)) return;
      // Date pickers portal outside the panel — keep filters open while using them.
      if (target.closest('[data-slot="popover-content"]')) return;
      setFiltersOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  function toggleFiltersOpen() {
    setFiltersOpen((open) => {
      if (!open) setDraftFilters(filters);
      return !open;
    });
  }

  function updateDraftFilters(patch: Partial<FinancesFilterState>) {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  }

  function clearDraftFilters() {
    setDraftFilters(DEFAULT_FINANCES_FILTERS);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFiltersOpen(false);
  }

  function toggleCaptainFilter(captain: CaptainName, checked: boolean) {
    setDraftFilters((prev) => {
      const next = checked
        ? [...new Set([...prev.captains, captain])]
        : prev.captains.filter((name) => name !== captain);

      return { ...prev, captains: next.length > 0 ? next : [] };
    });
  }

  function getCustomTablesSnapshot() {
    if (!selectedTableId.startsWith("custom:")) return customTables;

    return {
      ...customTables,
      [selectedTableId]: {
        issues: [...issues],
        payments: { ...payments },
        paid: new Set(paid),
      },
    };
  }

  function resetTableUiState() {
    setEditedCells({});
    setSubstitutes({});
    setCellComments(initialCellComments());
    setFlashTriggers({});
    setEditingCell(null);
    setDraftIssue(null);
    setConfirmDialog(null);
    setOverrideNote("");
    setFilters(DEFAULT_FINANCES_FILTERS);
    setDraftFilters(DEFAULT_FINANCES_FILTERS);
    setFiltersOpen(false);
    setIsEditingTableTitle(false);
    setTableTitleEditValue("");
    setLockedIssues(new Set());
  }

  function loadTableData(tableId: string, tables: Record<string, CustomFinanceTable>) {
    if (tableId.startsWith("custom:")) {
      const table = tables[tableId] ?? createEmptyCustomTable();
      setIssues([...table.issues]);
      setPayments({ ...table.payments });
      setPaid(new Set(table.paid));
      return;
    }

    const table = getPaymentYearTable(Number(tableId) as PaymentYear);
    setIssues([...table.issues]);
    setPayments({ ...table.payments });
    setPaid(new Set(table.paid));
  }

  function handleSelectTable(tableId: string) {
    const nextCustomTables = getCustomTablesSnapshot();
    if (selectedTableId.startsWith("custom:")) {
      setCustomTables(nextCustomTables);
    }

    const nextTable = tableOptions.find((option) => option.id === tableId);
    setSelectedTableId(tableId);
    loadTableData(tableId, nextCustomTables);
    resetTableUiState();
    setShowArchiveBanner(nextTable?.archived ?? false);
  }

  function openCreateTableDialog() {
    setOverflowOpen(false);
    setNewTableName("");
    setCreateTableOpen(true);
  }

  function handleArchiveTable() {
    if (isArchivedYear) return;

    setOverflowOpen(false);
    setEditingCell(null);
    setDraftIssue(null);
    setConfirmDialog(null);
    setTableOptions((prev) =>
      prev.map((option) => {
        if (option.id !== selectedTableId || option.archived) return option;

        const baseLabel = option.label.replace(" (archived)", "");
        return {
          ...option,
          archived: true,
          label: `${baseLabel} (archived)`,
        };
      }),
    );
    setShowArchiveBanner(true);
  }

  function closeCreateTableDialog() {
    setCreateTableOpen(false);
    setNewTableName("");
  }

  function handleCreateTable() {
    const label = newTableName.trim();
    if (!label) return;

    const nextCustomTables = getCustomTablesSnapshot();
    if (selectedTableId.startsWith("custom:")) {
      setCustomTables(nextCustomTables);
    }

    const id = createCustomTableId(
      label,
      tableOptions.map((option) => option.id),
    );
    const emptyTable = createEmptyCustomTable();
    const tablesWithNew = { ...nextCustomTables, [id]: emptyTable };

    setCustomTables(tablesWithNew);
    setTableOptions((prev) => [{ id, label, archived: false }, ...prev]);
    setSelectedTableId(id);
    setIssues([]);
    setPayments({});
    setPaid(new Set());
    resetTableUiState();
    closeCreateTableDialog();
  }

  function handleCommentChange(key: CellKey, comment: string) {
    setCellComments((prev) => {
      if (!comment) {
        const next = { ...prev };
        delete next[key];
        return next;
      }

      return { ...prev, [key]: comment };
    });
  }

  function getSubstituteCaptain(key: CellKey): SubstituteCaptainAssignment {
    return substitutes[key] ?? "None";
  }

  function handleSubstituteChange(
    key: CellKey,
    columnCaptain: CaptainName,
    captain: SubstituteCaptainName,
  ) {
    setSubstitutes((prev) => {
      if (captain === columnCaptain) {
        const next = { ...prev };
        delete next[key];
        return next;
      }

      return { ...prev, [key]: captain };
    });
  }

  function handleMarkPaid(key: CellKey) {
    if (isArchivedYear) return;
    setPaid((prev) => new Set(prev).add(key));
  }

  function handleDoubleClick(key: CellKey) {
    const issueId = Number(key.slice(0, key.indexOf("-")));
    if (isArchivedYear || paid.has(key) || lockedIssues.has(issueId)) return;
    const value = getCellValue(key);
    setEditingCell(key);
    setEditValue(value.toFixed(2));
  }

  function handleEditSubmit(key: CellKey) {
    const numValue = parseFloat(editValue);
    const currentValue = getCellValue(key);
    setEditingCell(null);

    if (isNaN(numValue) || numValue === currentValue) return;

    setOverrideNote("");
    setConfirmDialog({
      key,
      value: numValue.toFixed(2),
      originalValue: editedCells[key]?.originalValue ?? payments[key] ?? 0,
    });
  }

  function closeConfirmDialog() {
    setConfirmDialog(null);
    setOverrideNote("");
  }

  function confirmEdit() {
    if (!confirmDialog || !overrideNote.trim()) return;
    const { key, value } = confirmDialog;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    setEditedCells((prev) => ({
      ...prev,
      [key]: {
        amount: numValue,
        originalValue: confirmDialog.originalValue,
        note: overrideNote.trim(),
      },
    }));
    setFlashTriggers((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    closeConfirmDialog();
  }

  function getCellValue(key: CellKey): number {
    return editedCells[key]?.amount ?? payments[key] ?? 0;
  }

  function handleAddIssue() {
    if (isArchivedYear || draftIssue) return;
    setDraftIssue({ label: "" });
  }

  function cancelDraftIssue() {
    setDraftIssue(null);
  }

  function commitDraftIssue() {
    if (!draftIssue) return;
    const label = draftIssue.label.trim();
    if (!label) {
      cancelDraftIssue();
      return;
    }

    const newIssue: Issue = {
      id: nextIssueId(issues),
      label,
      status: "open",
      date: new Date().toISOString().slice(0, 10),
    };
    setIssues((prev) => [newIssue, ...prev]);
    setPayments((prev) => ({
      ...prev,
      ...generatePaymentsForIssueAtIndex(newIssue, 0),
    }));
    cancelDraftIssue();
  }

  function handleDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraftIssue();
    }
    if (e.key === "Escape") {
      cancelDraftIssue();
    }
  }

  function handleDraftBlur() {
    if (!draftIssue) return;
    if (draftIssue.label.trim()) {
      commitDraftIssue();
    } else {
      cancelDraftIssue();
    }
  }

  function cancelTableTitleEdit() {
    setIsEditingTableTitle(false);
    setTableTitleEditValue("");
  }

  function startTableTitleEdit() {
    if (isArchivedYear || isEditingTableTitle) return;
    setTableTitleEditValue(tableDisplayLabel);
    setIsEditingTableTitle(true);
  }

  function commitTableTitleEdit() {
    const trimmed = tableTitleEditValue.trim();
    if (!trimmed) {
      cancelTableTitleEdit();
      return;
    }

    setTableOptions((prev) =>
      prev.map((option) => {
        if (option.id !== selectedTableId) return option;

        const suffix = option.archived ? " (archived)" : "";
        return { ...option, label: `${trimmed}${suffix}` };
      }),
    );
    cancelTableTitleEdit();
  }

  function handleTableTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTableTitleEdit();
    }
    if (event.key === "Escape") {
      cancelTableTitleEdit();
    }
  }

  function toggleIssueLock(issueId: number) {
    setLockedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });

    if (editingCell?.startsWith(`${issueId}-`)) {
      setEditingCell(null);
    }
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Switch payment year"
                        className="inline-flex items-center gap-1 text-md font-medium text-primary"
                        onDoubleClick={(event) => {
                          if (isArchivedYear) return;
                          event.preventDefault();
                          startTableTitleEdit();
                        }}
                      >
                        <span>{selectedTable.label}</span>
                        <ChevronDown
                          className="size-3.5 shrink-0 text-muted-foreground"
                          strokeWidth={2}
                        />
                      </button>
                    }
                  />
                  <DropdownMenuContent
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    className="min-w-[168px]"
                  >
                    <DropdownMenuRadioGroup
                      value={selectedTableId}
                      onValueChange={handleSelectTable}
                    >
                      {tableOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.id}
                          value={option.id}
                          className="data-checked:font-normal"
                        >
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm">Export as CSV</Button>
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
          <div className="relative flex flex-col gap-2">
            <div className="flex justify-end">
              <button
                ref={filterButtonRef}
                type="button"
                aria-label="Filter"
                aria-expanded={filtersOpen}
                aria-controls="finances-filter-panel"
                onClick={toggleFiltersOpen}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-[8px] border-[0.5px] border-border bg-bg text-muted-foreground transition-[background-color,color,border-color] duration-300 ease-out",
                  "hover:border-transparent hover:bg-muted hover:text-primary",
                  filtersOpen && "border-transparent bg-muted text-primary",
                )}
              >
                <Filter className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            <div
              ref={filterPanelRef}
              id="finances-filter-panel"
              role="dialog"
              aria-label="Filters"
              aria-hidden={!filtersOpen}
              data-open={filtersOpen ? "true" : "false"}
              className={cn(
                "fixed top-28 right-6 z-50 flex w-[284px] flex-col gap-2.5 rounded-lg border-[0.5px] border-[#e8eaef] bg-bg p-3 shadow-[0px_1px_2.5px_rgba(0,0,0,0.1)]",
                "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                filtersOpen
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none translate-x-8 opacity-0",
              )}
            >
              <div className="flex w-full flex-col gap-2">
                <p className="text-sm text-primary">Filters</p>

                <FilterSection label="Issue">
                  <FilterSegmentGroup<IssueFilterValue>
                    value={draftFilters.issue}
                    onChange={(issue) => updateDraftFilters({ issue })}
                    options={[
                      { value: "all", label: "All" },
                      { value: "open", label: "Open" },
                      { value: "closed", label: "Closed" },
                    ]}
                  />
                </FilterSection>

                <FilterSection label="Payment">
                  <FilterSegmentGroup<PaymentFilterValue>
                    value={draftFilters.payment}
                    onChange={(payment) => updateDraftFilters({ payment })}
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
                        value={draftFilters.startDate}
                        onChange={(startDate) => updateDraftFilters({ startDate })}
                      />
                    </div>
                    <span aria-hidden className="shrink-0 text-sm text-muted-foreground">
                      →
                    </span>
                    <div className="min-w-0 flex-1">
                      <DatePicker
                        label="End Date"
                        value={draftFilters.endDate}
                        onChange={(endDate) => updateDraftFilters({ endDate })}
                      />
                    </div>
                  </div>
                </FilterSection>

                <div className="border-t-[0.5px] border-[#e8eaef]" />

                <FilterSection label="Captain">
                  <div className="flex flex-col gap-2">
                    {CAPTAINS.map((captain) => {
                      const checked = draftFilters.captains.includes(captain);

                      return (
                        <label
                          key={captain}
                          className="flex cursor-pointer items-center gap-2 text-sm text-secondary"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) =>
                              toggleCaptainFilter(captain, nextChecked)
                            }
                            className="border-border bg-bg data-checked:border-primary data-checked:bg-primary data-checked:text-bg"
                          />
                          {captain}
                        </label>
                      );
                    })}
                  </div>
                </FilterSection>
              </div>

              <div className="flex w-full items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="text"
                  size="xs"
                  className="px-2 py-1 text-sm"
                  onClick={clearDraftFilters}
                >
                  Clear all
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="xs"
                  className="px-2 py-1 text-sm"
                  onClick={applyFilters}
                >
                  Apply
                </Button>
              </div>
            </div>

            <div className="overflow-hidden bg-bg">
              <Table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: ISSUE_COLUMN_WIDTH }} />
                  {visibleCaptains.map((captain) => (
                    <col key={captain} style={{ width: CAPTAIN_COLUMN_WIDTH }} />
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
                        key={captain}
                        className={cn(
                          "h-10 px-4 text-sm font-medium text-muted-foreground",
                          FINANCES_TABLE_CELL,
                        )}
                        style={{ width: CAPTAIN_COLUMN_WIDTH, minWidth: CAPTAIN_COLUMN_WIDTH }}
                      >
                        {captain}
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
                          key={`empty-${captain}`}
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
                          key={`draft-${captain}`}
                          className={cn("h-12", FINANCES_TABLE_CELL)}
                          style={{ width: CAPTAIN_COLUMN_WIDTH, minWidth: CAPTAIN_COLUMN_WIDTH }}
                        />
                      ))}
                    </TableRow>
                  )}
                  {visibleIssues.map((issue) => {
                    const isIssueLocked = lockedIssues.has(issue.id);

                    return (
                      <TableRow key={issue.id} className="border-0 hover:bg-transparent">
                        <TableCell
                          className={cn("h-12 p-2 text-md text-primary", FINANCES_TABLE_CELL)}
                          style={{ width: ISSUE_COLUMN_WIDTH, minWidth: ISSUE_COLUMN_WIDTH }}
                        >
                          <div className="group flex h-full w-full items-center justify-between gap-2">
                            <span className="min-w-0 whitespace-nowrap">{issue.label}</span>
                            {!isArchivedYear && (
                              <button
                                type="button"
                                aria-label={isIssueLocked ? "Unlock issue" : "Lock issue"}
                                onClick={() => toggleIssueLock(issue.id)}
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
                          const key: CellKey = `${issue.id}-${captain}`;
                          const isEditing = editingCell === key;

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
                                value={getCellValue(key)}
                                paid={paid.has(key)}
                                columnCaptain={captain}
                                substituteCaptain={getSubstituteCaptain(key)}
                                onSubstituteChange={(nextCaptain) =>
                                  handleSubstituteChange(key, captain, nextCaptain)
                                }
                                paymentDetail={getPaymentDetail(captain, issue)}
                                comment={cellComments[key]}
                                onCommentChange={(nextComment) =>
                                  handleCommentChange(key, nextComment)
                                }
                                overridden={!!editedCells[key]}
                                override={editedCells[key]}
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
            <DialogContent className="gap-6 p-5 sm:max-w-[450px]">
              <div className="flex w-full flex-col gap-4">
                <DialogTitle className="w-full text-md font-normal leading-[1.3] text-primary">
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
                />
              </div>

              <DialogFooter className="gap-4 border-0 p-0">
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
            <DialogContent className="gap-0 p-0 sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold leading-[1.3]">
                  Leave a note to override{" "}
                  {confirmDialog
                    ? `${formatCurrency(confirmDialog.originalValue)} to ${formatCurrency(parseFloat(confirmDialog.value))}`
                    : ""}
                </DialogTitle>
              </DialogHeader>

              <DialogBody className="gap-2">
                <DialogField className="gap-2">
                  <DialogDescription className="text-md text-primary">
                    This will replace the calculated value with a manual entry.
                  </DialogDescription>
                  <Textarea
                    placeholder="Enter a description…"
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    aria-label="Override note"
                    className="min-h-[88px] border-hairline px-3 py-2 text-md placeholder:text-secondary focus-visible:border-active focus-visible:ring-1 focus-visible:ring-active"
                  />
                </DialogField>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="text"
                  className="bg-active-grey hover:bg-active-grey/80"
                  onClick={closeConfirmDialog}
                >
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
