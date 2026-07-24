"use client"

import * as React from "react"
import { ChevronDown, Filter, MoreHorizontal, Plus, X } from "lucide-react"

import { PaymentCell } from "@/components/payment-cell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  CAPTAINS,
  INITIAL_ISSUES,
  type CellKey,
  type Issue,
  formatCurrency,
  generatePaymentsForIssueAtIndex,
  generatePaymentsForIssues,
  initialPaidCells,
  nextIssueId,
} from "./data"

/** Fixed column widths — table-layout:fixed; checking cells must not resize columns */
const ISSUE_COLUMN_WIDTH = 232
const CAPTAIN_COLUMN_WIDTH = 133

const FINANCES_TABLE_CELL = "border-[0.5px] border-border"

export default function FinancesPage() {
  const [issues, setIssues] = React.useState<Issue[]>(() => [...INITIAL_ISSUES])
  const [payments, setPayments] = React.useState(() => generatePaymentsForIssues(INITIAL_ISSUES))
  const [paid, setPaid] = React.useState<Set<CellKey>>(initialPaidCells)
  const [draftIssue, setDraftIssue] = React.useState<{ label: string } | null>(null)
  const [editingCell, setEditingCell] = React.useState<CellKey | null>(null)
  const [editValue, setEditValue] = React.useState("")
  const [confirmDialog, setConfirmDialog] = React.useState<{
    key: CellKey
    value: string
    originalValue: number
  } | null>(null)
  const [overrideNote, setOverrideNote] = React.useState("")
  const [editedCells, setEditedCells] = React.useState<Record<CellKey, number>>({})
  const [flashTriggers, setFlashTriggers] = React.useState<Partial<Record<CellKey, number>>>({})

  function handleMarkPaid(key: CellKey) {
    setPaid((prev) => new Set(prev).add(key))
  }

  function handleDoubleClick(key: CellKey) {
    const value = getCellValue(key)
    setEditingCell(key)
    setEditValue(value.toFixed(2))
  }

  function handleEditSubmit(key: CellKey) {
    const numValue = parseFloat(editValue)
    if (!isNaN(numValue)) {
      setOverrideNote("")
      setConfirmDialog({
        key,
        value: editValue,
        originalValue: getCellValue(key),
      })
    }
    setEditingCell(null)
  }

  function closeConfirmDialog() {
    setConfirmDialog(null)
    setOverrideNote("")
  }

  function confirmEdit() {
    if (!confirmDialog || !overrideNote.trim()) return
    const { key, value } = confirmDialog
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return
    setEditedCells((prev) => ({ ...prev, [key]: numValue }))
    setFlashTriggers((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))
    closeConfirmDialog()
  }

  function getCellValue(key: CellKey): number {
    return editedCells[key] ?? payments[key] ?? 0
  }

  function handleAddIssue() {
    if (draftIssue) return
    setDraftIssue({ label: "" })
  }

  function cancelDraftIssue() {
    setDraftIssue(null)
  }

  function commitDraftIssue() {
    if (!draftIssue) return
    const label = draftIssue.label.trim()
    if (!label) {
      cancelDraftIssue()
      return
    }

    const newIssue: Issue = { id: nextIssueId(issues), label }
    setIssues((prev) => [newIssue, ...prev])
    setPayments((prev) => ({
      ...prev,
      ...generatePaymentsForIssueAtIndex(newIssue, 0),
    }))
    cancelDraftIssue()
  }

  function handleDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      commitDraftIssue()
    }
    if (e.key === "Escape") {
      cancelDraftIssue()
    }
  }

  function handleDraftBlur() {
    if (!draftIssue) return
    if (draftIssue.label.trim()) {
      commitDraftIssue()
    } else {
      cancelDraftIssue()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-md text-muted-foreground">Finances</span>
          <span className="text-md text-muted-foreground">/</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-md font-medium text-primary"
          >
            2026 Payments
            <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm">Export as CSV</Button>
          <Button variant="outline" size="icon-sm" className="text-muted-foreground">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </div>
      </div>

      {/* Filter + table */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Filter"
            className="size-7 shrink-0 rounded-[8px] border-[0.5px] border-border bg-bg p-0 text-muted-foreground hover:bg-muted hover:text-primary"
          >
            <Filter className="size-4" strokeWidth={1.5} />
          </Button>
        </div>

        <div className="overflow-hidden bg-bg">
          <Table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: ISSUE_COLUMN_WIDTH }} />
              {CAPTAINS.map((captain) => (
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Add issue"
                      disabled={!!draftIssue}
                      onClick={handleAddIssue}
                      className="size-6 shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <Plus className="size-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </TableHead>
                {CAPTAINS.map((captain) => (
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
              {draftIssue && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell
                    className={cn("px-3 py-2", FINANCES_TABLE_CELL)}
                    style={{ width: ISSUE_COLUMN_WIDTH, minWidth: ISSUE_COLUMN_WIDTH }}
                  >
                    <Input
                      autoFocus
                      placeholder="Issue Name"
                      value={draftIssue.label}
                      onChange={(e) => setDraftIssue({ label: e.target.value })}
                      onKeyDown={handleDraftKeyDown}
                      onBlur={handleDraftBlur}
                      className="h-8 text-md"
                      aria-label="Issue name"
                    />
                  </TableCell>
                  {CAPTAINS.map((captain) => (
                    <TableCell
                      key={`draft-${captain}`}
                      className={cn("h-12", FINANCES_TABLE_CELL)}
                      style={{ width: CAPTAIN_COLUMN_WIDTH, minWidth: CAPTAIN_COLUMN_WIDTH }}
                    />
                  ))}
                </TableRow>
              )}
              {issues.map((issue) => (
                <TableRow key={issue.id} className="border-0 hover:bg-transparent">
                  <TableCell
                    className={cn("px-4 py-3 text-md text-primary", FINANCES_TABLE_CELL)}
                    style={{ width: ISSUE_COLUMN_WIDTH, minWidth: ISSUE_COLUMN_WIDTH }}
                  >
                    {issue.label}
                  </TableCell>
                  {CAPTAINS.map((captain) => {
                    const key: CellKey = `${issue.id}-${captain}`
                    const isEditing = editingCell === key

                    return (
                      <TableCell
                        key={key}
                        className={cn("p-0", FINANCES_TABLE_CELL)}
                        style={{ width: CAPTAIN_COLUMN_WIDTH, minWidth: CAPTAIN_COLUMN_WIDTH }}
                      >
                        <PaymentCell
                          value={getCellValue(key)}
                          paid={paid.has(key)}
                          overridden={key in editedCells}
                          flashTrigger={flashTriggers[key] ?? 0}
                          onMarkPaid={() => handleMarkPaid(key)}
                          isEditing={isEditing}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
                          onEditSubmit={() => handleEditSubmit(key)}
                          onEditCancel={() => setEditingCell(null)}
                          onDoubleClick={() => handleDoubleClick(key)}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

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
              variant="ghost"
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
              variant="destructive"
              disabled={!overrideNote.trim()}
              onClick={confirmEdit}
            >
              Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
