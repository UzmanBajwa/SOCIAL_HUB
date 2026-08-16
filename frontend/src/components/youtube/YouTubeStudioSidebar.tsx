import { CheckCircle2, ExternalLink, Film, Globe, Link2, Lock, Youtube } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Post, SocialAccount, YouTubePrivacy } from "@/types";
import { PRIVACY_OPTIONS, VISIBILITY_LABEL } from "./constants";
import { StudioStatusPill, type StudioStatus } from "./StudioStatusPill";
import { YouTubeUploadProgress, YouTubeUploadPulse } from "./YouTubeUploadProgress";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

interface YouTubeStudioSidebarProps {
  file: File | null;
  objectUrl: string | null;
  videoId: string | null;
  post: Post | null;
  privacy: YouTubePrivacy;
  status: StudioStatus;
  progress: number;
  speed: string | null;
  account: SocialAccount | undefined;
  disabled?: boolean;
  onPrivacyChange: (value: YouTubePrivacy) => void;
}

const PRIVACY_ICONS: Record<YouTubePrivacy, React.ReactNode> = {
  public: <Globe className="h-3.5 w-3.5" />,
  unlisted: <Link2 className="h-3.5 w-3.5" />,
  private: <Lock className="h-3.5 w-3.5" />,
};

export function YouTubeStudioSidebar({
  file,
  objectUrl,
  videoId,
  post,
  privacy,
  status,
  progress,
  speed,
  account,
  disabled,
  onPrivacyChange,
}: YouTubeStudioSidebarProps) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-card/40 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4" />
            Video preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {objectUrl ? (
            <video
              src={objectUrl}
              controls
              className="aspect-video w-full rounded-xl bg-black object-contain"
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/30 text-muted-foreground">
              <Film className="h-8 w-8" />
              <p className="text-xs">No video selected yet</p>
            </div>
          )}

          <div className="space-y-1 rounded-xl border border-border bg-card/40 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Video link</p>
            {videoId && post ? (
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                youtube.com/watch?v={videoId}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">Not available until published</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Visibility</p>
            <div className="grid grid-cols-1 gap-2">
              {PRIVACY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPrivacyChange(option.value)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                    privacy === option.value
                      ? "border-primary/60 bg-primary/10"
                      : "border-border hover:border-primary/30",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      privacy === option.value ? "border-primary" : "border-muted-foreground/40"
                    )}
                  >
                    {privacy === option.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {PRIVACY_ICONS[option.value]}
                    {option.label}
                  </span>
                  <span className="ml-auto text-[11px] leading-snug text-muted-foreground">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-card/40 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Youtube className="h-4 w-4" />
            Channel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {account ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={account.avatar_url ?? undefined} alt={account.account_name} />
                <AvatarFallback>{initials(account.account_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{account.account_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {account.account_username ?? "YouTube channel"} ·{" "}
                  <span className="capitalize">{account.status}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No channel selected.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Publishing to this channel as{" "}
            <span className="font-medium text-foreground">{VISIBILITY_LABEL[privacy]}</span>.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-card/40 px-5 py-4">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Upload status</span>
            <StudioStatusPill status={status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {status === "uploading" && (
            <>
              <YouTubeUploadProgress percent={progress} />
              <p className="text-right text-xs text-muted-foreground">
                {progress}%{speed ? ` · ${speed}` : ""}
              </p>
            </>
          )}
          {status === "processing" && <YouTubeUploadPulse />}
          {status === "completed" && (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Published to {account?.account_name ?? "YouTube"}
            </p>
          )}
          {status === "idle" && (
            <p className="text-xs text-muted-foreground">
              {file ? "Video selected — press Publish to YouTube to start." : "Select a video to begin."}
            </p>
          )}
          {status === "failed" && (
            <p className="text-xs text-muted-foreground">
              Upload failed — use Retry to try again or Discard to start over.
            </p>
          )}
          {status === "cancelled" && (
            <p className="text-xs text-muted-foreground">
              Upload cancelled — use Try again to retry or Discard to remove the video.
            </p>
          )}
          {status === "selected" && (
            <p className="text-xs text-muted-foreground">
              Video selected — press Publish to YouTube to start.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
