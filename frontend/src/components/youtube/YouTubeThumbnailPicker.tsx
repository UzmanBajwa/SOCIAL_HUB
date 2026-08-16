import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import type { DragEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { uploadMedia } from "@/api/media";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Media } from "@/types";
import { YouTubeUploadProgress } from "./YouTubeUploadProgress";

interface YouTubeThumbnailPickerProps {
  thumbnail: Media | null;
  disabled?: boolean;
  onThumbnail: (media: Media) => void;
  onRemove: () => void;
}

export interface YouTubeThumbnailPickerHandle {
  open: () => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export const YouTubeThumbnailPicker = forwardRef<
  YouTubeThumbnailPickerHandle,
  YouTubeThumbnailPickerProps
>(function YouTubeThumbnailPicker(
  { thumbnail, disabled, onThumbnail, onRemove },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        if (!disabled && !uploading) inputRef.current?.click();
      },
    }),
    [disabled, uploading]
  );

  const handleFile = useCallback(
    async (candidate: File | undefined | null) => {
      if (!candidate || disabled) return;
      if (!candidate.type.startsWith("image/")) {
        toast({ title: "Thumbnails must be images", variant: "destructive" });
        return;
      }
      setUploading(true);
      setProgress(0);
      try {
        const media = await uploadMedia(candidate, setProgress);
        onThumbnail(media);
      } catch (error) {
        toast({
          title: "Thumbnail upload failed",
          description: getApiErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [disabled, onThumbnail]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      handleFile(event.dataTransfer.files?.[0]);
    },
    [handleFile]
  );

  if (thumbnail) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-card/40">
        <img src={thumbnail.file_url} alt="Video thumbnail" className="aspect-video w-full object-cover" />
        <div className="flex items-center justify-between gap-3 border-t border-border bg-card/60 px-4 py-2.5">
          <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
            {thumbnail.file_name}
          </p>
          <button
            type="button"
            onClick={() => {
              onRemove();
              setProgress(0);
            }}
            disabled={disabled || uploading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={disabled || uploading}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card/30 hover:border-primary/50",
          (disabled || uploading) && "cursor-not-allowed opacity-60"
        )}
      >
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Add a custom thumbnail</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            JPG, PNG or WebP · optional
          </p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        disabled={disabled || uploading}
      />
      {uploading && <YouTubeUploadProgress percent={progress} label="Uploading thumbnail" />}
    </div>
  );
});
