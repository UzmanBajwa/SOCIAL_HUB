import { Loader2, Rocket, Save, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { YouTubePrivacy } from "@/types";
import { VISIBILITY_LABEL } from "./constants";
import { StudioStatusPill, type StudioStatus } from "./StudioStatusPill";

interface YouTubePublishBarProps {
  file: File | null;
  status: StudioStatus;
  privacy: YouTubePrivacy;
  busy: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
}

export function YouTubePublishBar({
  file,
  status,
  privacy,
  busy,
  canPublish,
  onPublish,
  onSaveDraft,
  onCancel,
}: YouTubePublishBarProps) {
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/80 px-5 py-4 shadow-soft-lg backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        {file ? (
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{file.name}</span> · publishing as{" "}
            <span className="font-medium text-foreground">{VISIBILITY_LABEL[privacy]}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No video selected yet</span>
        )}
        <StudioStatusPill status={status} className="hidden sm:inline-flex" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={busy || !canPublish}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save draft
        </Button>
        {busy && (
          <Button variant="ghost" onClick={onCancel} className="gap-1.5 text-destructive">
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        )}
        <Button
          onClick={onPublish}
          disabled={!canPublish}
          className="min-w-44"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === "processing" ? "Publishing…" : "Uploading…"}
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Publish to YouTube
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
