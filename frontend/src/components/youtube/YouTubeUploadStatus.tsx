import { CheckCircle2, ExternalLink, RefreshCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProcessingCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <RefreshCcw className="h-6 w-6 animate-spin" />
        </span>
      </div>
      <div>
        <p className="text-sm font-medium">Processing</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

interface UploadFailedCardProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function UploadFailedCard({ error, onRetry, onCancel }: UploadFailedCardProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <XCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">Upload failed</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">{error}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Discard
        </Button>
      </div>
    </div>
  );
}

interface UploadCompleteCardProps {
  videoId: string;
  className?: string;
}

export function UploadCompleteCard({ videoId, className }: UploadCompleteCardProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 py-8 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Video published</p>
        <p className="text-xs text-muted-foreground">
          Video ID: <span className="font-mono text-foreground">{videoId}</span>
        </p>
      </div>
      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View on YouTube
      </a>
    </div>
  );
}
