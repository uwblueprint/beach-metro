"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidePanelSectionProps {
  title: string;
  onAdd?: () => void;
  onEdit?: () => void;
  children: ReactNode;
  className?: string;
}

function SidePanelSection({ title, onAdd, onEdit, children, className }: SidePanelSectionProps) {
  return (
    <div className={cn("flex flex-col gap-1 pb-6 pt-1", className)}>
      <div className="flex h-8 items-center justify-between rounded-[4px] py-[7px] pl-2 pr-0">
        <span className="text-md font-semibold text-primary">{title}</span>
        {(onAdd || onEdit) && (
          <div className="flex items-center gap-0.5">
            {onEdit && (
              <Button
                variant="text"
                size="icon-sm"
                aria-label="Edit"
                onClick={onEdit}
                className="text-secondary"
              >
                <Pencil className="size-3" />
              </Button>
            )}
            {onAdd && (
              <Button
                variant="text"
                size="icon-sm"
                aria-label="Add"
                onClick={onAdd}
                className="text-secondary"
              >
                <Plus className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export { SidePanelSection };
