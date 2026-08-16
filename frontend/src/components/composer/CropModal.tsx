import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const VIEWPORT = 320;
const EXPORT_SIZE = 1080;

export function CropModal({
  imageUrl,
  onCancel,
  onConfirm,
}: {
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const baseScale = naturalSize ? Math.max(VIEWPORT / naturalSize.w, VIEWPORT / naturalSize.h) : 1;
  const scale = baseScale * zoom;
  const displayedW = naturalSize ? naturalSize.w * scale : VIEWPORT;
  const displayedH = naturalSize ? naturalSize.h * scale : VIEWPORT;
  const minX = Math.min(0, VIEWPORT - displayedW);
  const minY = Math.min(0, VIEWPORT - displayedH);

  useEffect(() => {
    // Re-center whenever zoom changes so panning stays within bounds.
    setPan((prev) => ({
      x: Math.min(0, Math.max(minX, prev.x)),
      y: Math.min(0, Math.max(minY, prev.y)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, naturalSize]);

  function handlePointerDown(e: React.PointerEvent) {
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPan({
      x: Math.min(0, Math.max(minX, dragState.current.panX + dx)),
      y: Math.min(0, Math.max(minY, dragState.current.panY + dy)),
    });
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  async function handleSave() {
    if (!naturalSize) return;
    setIsSaving(true);
    try {
      const sourceSize = VIEWPORT / scale;
      const sourceX = -pan.x / scale;
      const sourceY = -pan.y / scale;

      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx || !imgRef.current) return;
      ctx.drawImage(imgRef.current, sourceX, sourceY, sourceSize, sourceSize, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (blob) await onConfirm(blob);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>Drag to reposition, use the slider to zoom.</DialogDescription>
        </DialogHeader>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-lg border border-border bg-black"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop preview"
            crossOrigin="anonymous"
            onLoad={(e) => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            draggable={false}
            className="absolute select-none"
            style={{ left: pan.x, top: pan.y, width: displayedW, height: displayedH, cursor: "grab" }}
          />
        </div>

        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !naturalSize} className="gap-1.5">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
