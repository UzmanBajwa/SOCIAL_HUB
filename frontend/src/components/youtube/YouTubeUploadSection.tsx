import { Film, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Post } from "@/types";
import { StudioSectionCard } from "./StudioSectionCard";
import { StudioStatusPill, type StudioStatus } from "./StudioStatusPill";
import { YouTubeUploadProgress } from "./YouTubeUploadProgress";
import { ProcessingCard, UploadCompleteCard, UploadFailedCard } from "./YouTubeUploadStatus";
import { YouTubeVideoUploader } from "./YouTubeVideoUploader";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

interface YouTubeUploadSectionProps {
  file: File | null;
  objectUrl: string | null;
  status: StudioStatus;
  progress: number;
  speed: string | null;
  errorMsg: string | null;
  videoId: string | null;
  post: Post | null;
  duration: number | null;
  onDuration: (seconds: number) => void;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  onCancel: () => void;
  onRetry: () => void;
  disabled: boolean;
}

export function YouTubeUploadSection({
  file,
  objectUrl,
  status,
  progress,
  speed,
  errorMsg,
  videoId,
  post,
  duration,
  onDuration,
  onFileSelect,
  onRemove,
  onCancel,
  onRetry,
  disabled,
}: YouTubeUploadSectionProps) {
  return (
    <StudioSectionCard
      title="Upload video"
      description="Select a video file to begin."
      icon={<Film className="h-4 w-4" />}
      badge={<StudioStatusPill status={status} />}
    >
      <YouTubeVideoUploader
        file={file}
        objectUrl={objectUrl}
        onFileSelect={onFileSelect}
        onRemove={onRemove}
        onDuration={onDuration}
        disabled={disabled}
      />

      {file && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card/40 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{file.name}</span>
          </span>
          <span>{formatBytes(file.size)}</span>
          {duration !== null && <span>{formatDuration(duration)}</span>}
          <span className="uppercase">{file.type.split("/")[1] ?? "video"}</span>
        </div>
      )}

      {status === "uploading" && (
        <div className="space-y-2">
          <YouTubeUploadProgress percent={progress} label="Uploading to YouTube" />
          {speed && <p className="text-right text-xs text-muted-foreground">{speed}</p>}
        </div>
      )}

      {status === "processing" && (
        <ProcessingCard message="YouTube is storing your video. Your details are being finalized and the post is being created…" />
      )}

      {status === "completed" && post && videoId && <UploadCompleteCard videoId={videoId} />}

      {status === "failed" && (
        <UploadFailedCard error={errorMsg ?? "Something went wrong."} onRetry={onRetry} onCancel={onRemove} />
      )}

      {status === "cancelled" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">Upload cancelled — you can try again or discard this video.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
            <Button size="sm" variant="outline" onClick={onRemove}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {status === "uploading" && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel upload
          </Button>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UploadCloud className="h-3.5 w-3.5" />
        Uploaded via a direct resumable stream — no recompression, no size distortion.
      </p>
    </StudioSectionCard>
  );
}
