import { CheckCircle2, Pin, Clapperboard } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface FacebookOptionsProps {
  mediaType: "image" | "video" | null;
  isPinned: boolean;
  onIsPinnedChange: (value: boolean) => void;
  publishAsReel: boolean;
  onPublishAsReelChange: (value: boolean) => void;
  disabled?: boolean;
}

export function FacebookOptions({
  mediaType,
  isPinned,
  onIsPinnedChange,
  publishAsReel,
  onPublishAsReelChange,
  disabled,
}: FacebookOptionsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success" />
        Always published to News Feed
      </div>

      {mediaType === "video" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="fb-publish-as-reel">Publish as Reel</Label>
              <p className="text-xs text-muted-foreground">Uses Facebook's Reels format instead of a regular video post.</p>
            </div>
          </div>
          <Switch
            id="fb-publish-as-reel"
            checked={publishAsReel}
            onCheckedChange={onPublishAsReelChange}
            disabled={disabled}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label htmlFor="fb-is-pinned">Pin post after publishing</Label>
            <p className="text-xs text-muted-foreground">Keeps this post at the top of the Page until unpinned.</p>
          </div>
        </div>
        <Switch id="fb-is-pinned" checked={isPinned} onCheckedChange={onIsPinnedChange} disabled={disabled} />
      </div>

      <p className="text-xs text-muted-foreground">
        Enable Comments and Share to Story aren't offered here &mdash; Meta's Graph API doesn't expose a
        reliable way to control either for a Page post from a third-party app, so we don't fake controls
        that wouldn't actually do anything.
      </p>
    </div>
  );
}
