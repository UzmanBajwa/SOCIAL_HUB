import { Crop as CropIcon, GripVertical, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { uploadMedia } from "@/api/media";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types";

import { CropModal } from "./CropModal";

const MAX_CAROUSEL_ITEMS = 10;

export function MediaUploader({
  items,
  onChange,
  disabled,
  hasInstagramSelected = false,
}: {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  disabled?: boolean;
  hasInstagramSelected?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOverZone, setDragOverZone] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null);

  const hasVideo = items.some((i) => i.type === "video");
  const canAddMore = !hasVideo && items.length < MAX_CAROUSEL_ITEMS;

  async function uploadFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (items.length === 0 && fileArray.length > 1 && fileArray.some((f) => f.type.startsWith("video/"))) {
      toast({ title: "Pick one video, or multiple images for a carousel", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const file of fileArray) {
        const media = await uploadMedia(file);
        uploaded.push({ url: media.file_url, type: media.type });
      }
      const isVideo = uploaded.some((u) => u.type === "video");
      if (isVideo && (items.length > 0 || uploaded.length > 1)) {
        toast({
          title: "Facebook carousels support images only",
          description: "A video must be the only item in the post.",
          variant: "destructive",
        });
        onChange(uploaded.slice(0, 1));
      } else {
        onChange([...items, ...uploaded].slice(0, MAX_CAROUSEL_ITEMS));
      }
    } catch (error) {
      toast({ title: "Upload failed", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) void uploadFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOverZone(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  async function handleReplaceChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || replaceTarget === null) return;
    setUploading(true);
    try {
      const media = await uploadMedia(file);
      const next = [...items];
      next[replaceTarget] = { url: media.file_url, type: media.type };
      onChange(next);
    } catch (error) {
      toast({ title: "Replace failed", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setUploading(false);
      setReplaceTarget(null);
    }
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.url + index}
              draggable={!disabled && items.length > 1}
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null) reorder(draggedIndex, index);
                setDraggedIndex(null);
              }}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary"
            >
              {item.type === "video" ? (
                <video src={item.url} className="h-full w-full object-cover" />
              ) : (
                <img src={item.url} alt={`Media ${index + 1}`} className="h-full w-full object-cover" />
              )}

              {items.length > 1 && (
                <div className="absolute left-1.5 top-1.5 flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
              )}

              {!disabled && (
                <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {item.type === "image" && (
                    <button
                      type="button"
                      onClick={() => setCropIndex(index)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
                      aria-label="Crop"
                    >
                      <CropIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReplaceTarget(index);
                      replaceInputRef.current?.click();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80"
                    aria-label="Replace"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {index === 0 && items.length > 1 && (
                <span className="absolute left-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {hasInstagramSelected && items.some((i) => i.type === "image") && (
        <p className="text-xs text-muted-foreground">
          Instagram: images outside 4:5–1.91:1 will be automatically center-cropped.
        </p>
      )}

      {!disabled && canAddMore && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone(true);
          }}
          onDragLeave={() => setDragOverZone(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground transition-colors hover:bg-accent",
            dragOverZone ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span>
                {items.length === 0
                  ? "Drag & drop or click to upload an image, video, or multiple images for a carousel"
                  : "Add another image to the carousel"}
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleInputChange}
            disabled={uploading}
          />
        </label>
      )}

      <input ref={replaceInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleReplaceChange} />

      {cropIndex !== null && items[cropIndex] && (
        <CropModal
          imageUrl={items[cropIndex].url}
          onCancel={() => setCropIndex(null)}
          onConfirm={async (blob) => {
            setUploading(true);
            try {
              const file = new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
              const media = await uploadMedia(file);
              const next = [...items];
              next[cropIndex] = { url: media.file_url, type: "image" };
              onChange(next);
            } catch (error) {
              toast({ title: "Crop upload failed", description: getApiErrorMessage(error), variant: "destructive" });
            } finally {
              setUploading(false);
              setCropIndex(null);
            }
          }}
        />
      )}
    </div>
  );
}
