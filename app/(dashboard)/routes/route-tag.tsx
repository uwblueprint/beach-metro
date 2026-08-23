import { cn } from "@/lib/utils";

/** Route label chip — shared by deliveries list and map hover preview. */
export function RouteTag({ label, vacant }: { label: string; vacant?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-lg px-2 py-1 text-md",
        vacant ? "bg-tag-destructive text-destructive" : "bg-tag text-primary",
      )}
    >
      {label}
    </span>
  );
}
