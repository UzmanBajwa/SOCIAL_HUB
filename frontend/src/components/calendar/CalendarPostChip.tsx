import { Link } from "react-router-dom";

import { PlatformIcon } from "@/components/PlatformIcon";
import { cn } from "@/lib/utils";
import type { Post } from "@/types";

const STATUS_DOT: Record<Post["status"], string> = {
  draft: "bg-muted-foreground",
  scheduled: "bg-primary",
  publishing: "bg-amber-500",
  published: "bg-success",
  partially_published: "bg-amber-500",
  failed: "bg-destructive",
};

export function CalendarPostChip({ post }: { post: Post }) {
  const time = post.publish_date
    ? new Date(post.publish_date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <Link
      to={`/posts/${post.id}`}
      className="flex items-center gap-1.5 rounded-md border border-border bg-card px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[post.status])} />
      <div className="flex shrink-0 -space-x-1">
        {post.platforms.slice(0, 2).map((p) => (
          <PlatformIcon key={p.id} platform={p.platform} className="h-3.5 w-3.5 p-0.5" />
        ))}
      </div>
      <span className="truncate">{time ?? (post.content || "Draft")}</span>
    </Link>
  );
}
