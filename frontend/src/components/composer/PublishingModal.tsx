import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Rocket, X } from "lucide-react";

import { PlatformIcon } from "@/components/PlatformIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Platform, Post } from "@/types";

export interface PublishTarget {
  accountId: string;
  platform: Platform;
  accountName: string;
}

interface PublishingModalProps {
  open: boolean;
  targets: PublishTarget[];
  isPending: boolean;
  isError: boolean;
  errorMessage?: string | null;
  result: Post | null;
  onClose: () => void;
}

function ProgressRow({
  target,
  status,
  errorMessage,
}: {
  target: PublishTarget;
  status: "pending" | "publishing" | "published" | "failed";
  errorMessage?: string | null;
}) {
  const isDone = status === "published";
  const isFailed = status === "failed";
  const isActive = status === "pending" || status === "publishing";

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <PlatformIcon platform={target.platform} className="h-6 w-6" />
          {target.accountName}
        </span>
        {isDone && (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" />
            Published
          </span>
        )}
        {isFailed && (
          <span className="flex items-center gap-1 text-xs font-medium text-destructive">
            <X className="h-3.5 w-3.5" />
            Failed
          </span>
        )}
        {isActive && <span className="text-xs text-muted-foreground">Publishing&hellip;</span>}
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        {isActive ? (
          <motion.div
            className="h-full w-1/3 rounded-full bg-gradient-brand"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <motion.div
            className={cn("h-full rounded-full", isDone ? "bg-gradient-brand" : "bg-destructive")}
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        )}
      </div>

      {isFailed && errorMessage && <p className="mt-1.5 text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}

export function PublishingModal({ open, targets, isPending, isError, errorMessage, result, onClose }: PublishingModalProps) {
  const canClose = !isPending;
  const succeeded = result?.platforms.filter((p) => p.status === "published").length ?? 0;
  const total = targets.length;
  const allGood = result ? succeeded === total : false;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => canClose && onClose()}
        >
          <motion.div
            className="glass-panel-strong w-full max-w-md rounded-2xl border border-border p-6 shadow-soft-lg"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Rocket className="h-5 w-5 text-primary" />
              Publishing Campaign
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPending
                ? "Sending your post to each connected platform..."
                : isError
                  ? "We couldn't reach the server."
                  : "Here's how your campaign went."}
            </p>

            <div className="mt-5 space-y-4">
              {targets.map((target) => {
                const platformResult = result?.platforms.find((p) => p.social_account_id === target.accountId);
                const status: "pending" | "publishing" | "published" | "failed" = isPending
                  ? "publishing"
                  : (platformResult?.status as "published" | "failed" | undefined) ?? "pending";
                return (
                  <ProgressRow
                    key={target.accountId}
                    target={target}
                    status={status}
                    errorMessage={platformResult?.error_message}
                  />
                );
              })}
            </div>

            {isError && (
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage || "Something went wrong before we could publish. Please try again."}</span>
              </div>
            )}

            {result && (
              <div
                className={cn(
                  "mt-5 rounded-lg border p-3 text-center text-sm font-medium",
                  allGood
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {allGood ? "🎉 " : ""}
                {succeeded}/{total} platform{total === 1 ? "" : "s"} published successfully
              </div>
            )}

            {canClose && (
              <Button className="mt-5 w-full" onClick={onClose}>
                Done
              </Button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
