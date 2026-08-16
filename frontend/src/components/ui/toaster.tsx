import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { dismissToast, useToasts } from "@/hooks/use-toast";

export function Toaster() {
  const toasts = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "glass-panel-strong pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-border p-4 shadow-soft-lg animate-in slide-in-from-bottom-2",
            t.variant === "destructive" && "border-destructive/30 bg-destructive/5",
            t.variant === "success" && "border-success/30 bg-success/5"
          )}
        >
          <div>
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
