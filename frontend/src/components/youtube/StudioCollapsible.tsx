import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface StudioCollapsibleProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}

export function StudioCollapsible({
  title,
  description,
  defaultOpen = false,
  right,
  children,
}: StudioCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-card/50"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              !open && "-rotate-90"
            )}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{title}</span>
            {description && (
              <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
            )}
          </span>
        </span>
        {right}
      </button>
      {open && <div className="space-y-4 border-t border-border/60 px-4 py-4">{children}</div>}
    </div>
  );
}
