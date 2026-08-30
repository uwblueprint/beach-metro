"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogField,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useRetireMember, type MemberRole } from "@/features/members/api";

export interface RetireMemberTarget {
  id: string;
  role: MemberRole;
  name: string;
}

export interface RetireMemberDialogProps {
  member: RetireMemberTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetired?: () => void;
}

function retireConsequence(role: MemberRole): string {
  return role === "volunteer"
    ? "Their routes will become vacant."
    : "Their territory will be left without a captain.";
}

function RetireMemberForm({
  member,
  onOpenChange,
  onRetired,
}: {
  member: RetireMemberTarget;
  onOpenChange: (open: boolean) => void;
  onRetired?: () => void;
}) {
  const retire = useRetireMember();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleRetire() {
    setError(null);
    const trimmed = reason.trim();
    try {
      await retire.mutateAsync({
        id: member.id,
        role: member.role,
        note: trimmed || undefined,
      });
      onOpenChange(false);
      onRetired?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retire this member.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Retire {member.name}?</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <DialogDescription>{retireConsequence(member.role)}</DialogDescription>
        <DialogField>
          <Label htmlFor="retire-reason" className="text-md font-normal text-primary">
            Retirement reason
          </Label>
          <Textarea
            id="retire-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this member retiring?"
            aria-label="Retirement reason"
          />
        </DialogField>
        {error ? <p className="text-md text-destructive">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="default" disabled={retire.isPending} />}>
          Cancel
        </DialogClose>
        <Button type="button" variant="danger" disabled={retire.isPending} onClick={handleRetire}>
          {retire.isPending ? "Retiring…" : "Retire member"}
        </Button>
      </DialogFooter>
    </>
  );
}

function RetireMemberDialog({ member, open, onOpenChange, onRetired }: RetireMemberDialogProps) {
  // Remount the form when the target changes so reason/error don't leak across members.
  const formKey = member ? `${member.role}:${member.id}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && member ? (
          <RetireMemberForm
            key={formKey}
            member={member}
            onOpenChange={onOpenChange}
            onRetired={onRetired}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export { RetireMemberDialog };
