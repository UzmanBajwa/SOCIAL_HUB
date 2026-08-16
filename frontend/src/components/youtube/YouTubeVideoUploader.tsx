import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Film, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { isValidVideoFile, MAX_VIDEO_MB } from "./constants";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

interface YouTubeVideoUploaderProps {
  file: File | null;
  objectUrl: string | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  onDuration?: (seconds: number) => void;
  disabled?: boolean;
}

export function YouTubeVideoUploader({
  file,
  objectUrl,
  onFileSelect,
  onRemove,
  onDuration,
  disabled,
}: YouTubeVideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (candidate: File | undefined | null) => {
      if (!candidate) return;
      const result = isValidVideoFile(candidate);
      if (!result.ok) {
        setError(result.reason ?? "Invalid video file.");
        return;
      }
      setError(null);
      onFileSelect(candidate);
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      if (disabled) return;
      handleFile(event.dataTransfer.files?.[0]);
    },
    [disabled, handleFile]
  );

  if (file && objectUrl) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-card/40">
        <video
          src={objectUrl}
          controls
          onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)}
          className="aspect-video w-full bg-black object-contain"
        />
        <div className="flex items-center justify-between gap-3 border-t border-border bg-card/60 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)} · {file.type || "video"}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={disabled}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card/30 hover:border-primary/50 hover:bg-card/50",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {dragOver ? "Drop to upload" : "Drag & drop your video"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV or WebM · up to {MAX_VIDEO_MB}MB · or{" "}
            <span className="font-medium text-primary underline underline-offset-2">browse</span>
          </p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        disabled={disabled}
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {!error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Film className="h-3.5 w-3.5" />
          Uploaded via a direct resumable stream — no recompression, no size distortion.
        </p>
      )}
    </div>
  );
}
