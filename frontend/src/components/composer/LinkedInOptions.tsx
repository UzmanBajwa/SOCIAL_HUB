import { AlertTriangle, Building2 } from "lucide-react";

import type { SocialAccount } from "@/types";

export function LinkedInOptions({
  account,
  mediaItemCount,
}: {
  account: SocialAccount;
  mediaItemCount: number;
}) {
  const hasCarousel = mediaItemCount > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        Publishing as <span className="font-medium text-foreground">{account.account_name}</span> (Company Page)
      </div>

      {hasCarousel && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            LinkedIn doesn't support multi-image carousel posts. Remove extra images above (keep just one), or
            deselect LinkedIn.
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Mentions, location tagging, and article-style posts aren't available for LinkedIn yet &mdash; only
        text, a single image, or a single video.
      </p>
    </div>
  );
}
