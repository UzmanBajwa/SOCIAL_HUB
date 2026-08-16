import { cn } from "@/lib/utils";

export type StudioStatus =
  | "idle"
  | "selected"
  | "uploading"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

const META: Record<StudioStatus, { label: string; dot: string; text: string }> = {
  idle: {
    label: "No video",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
  selected: {
    label: "Ready",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  uploading: {
    label: "Uploading",
    dot: "bg-red-500 animate-pulse",
    text: "text-red-600 dark:text-red-400",
  },
  processing: {
    label: "Processing",
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-600 dark:text-amber-400",
  },
  completed: {
    label: "Published",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  failed: {
    label: "Failed",
    dot: "bg-destructive",
    text: "text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
};

interface StudioStatusPillProps {
  status: StudioStatus;
  className?: string;
}

export function StudioStatusPill({ status, className }: StudioStatusPillProps) {
  const meta = META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs font-medium",
        meta.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
