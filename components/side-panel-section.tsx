"use client";

import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidePanelSectionProps {
  title: string;
  onAdd?: () => void;
  children: ReactNode;
  className?: string;
}

function SidePanelSection({ title, onAdd, children, className }: SidePanelSectionProps) {
  return (
    <div className={cn("flex flex-col gap-1 px-1 pb-6 pt-1", className)}>
      <div className="flex h-8 items-center justify-between rounded-[4px] py-[7px] pl-2 pr-1">
        <span className="text-md font-semibold text-primary">{title}</span>
        {onAdd && (
          <Button variant="text" size="icon-sm" onClick={onAdd}>
            <Plus className="size-3" />
          </Button>
        )}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export { SidePanelSection };
