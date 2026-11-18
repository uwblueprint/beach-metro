"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { useDeleteMember, type MemberRole } from "@/features/members/api";

export interface DeleteMemberTarget {
  id: string;
  role: MemberRole;
  name: string;
}

export interface DeleteMemberDialogProps {
  member: DeleteMemberTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (memberId: string) => void;
}

function deleteConsequence(role: MemberRole): string {
  return role === "volunteer"
    ? "Their routes will become vacant."
    : "Their territory will be deleted and every volunteer in it will be left without a territory.";
}

function DeleteMemberForm({
  member,
  onOpenChange,
  onDeleted,
}: {
  member: DeleteMemberTarget;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (memberId: string) => void;
}) {
  const deleteMember = useDeleteMember();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteMember.mutateAsync({ id: member.id, role: member.role });
      onOpenChange(false);
      onDeleted?.(member.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this member.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Permanently delete {member.name}? This cannot be undone.</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-md text-secondary">{deleteConsequence(member.role)}</p>
        {error ? <p className="text-md text-destructive">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="default" disabled={deleteMember.isPending} />}>
          Cancel
        </DialogClose>
        <Button
          type="button"
          variant="danger"
          disabled={deleteMember.isPending}
          onClick={handleDelete}
        >
          {deleteMember.isPending ? "Deleting…" : "Delete member"}
        </Button>
      </DialogFooter>
    </>
  );
}

function DeleteMemberDialog({ member, open, onOpenChange, onDeleted }: DeleteMemberDialogProps) {
  // Remount the form when the target changes so an error doesn't leak across members.
  const formKey = member ? `${member.role}:${member.id}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && member ? (
          <DeleteMemberForm
            key={formKey}
            member={member}
            onOpenChange={onOpenChange}
            onDeleted={onDeleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export { DeleteMemberDialog };
