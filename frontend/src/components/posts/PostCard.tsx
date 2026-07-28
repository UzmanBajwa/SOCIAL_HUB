import { Image as ImageIcon, Video } from "lucide-react";
import { Link } from "react-router-dom";

import { PlatformIcon } from "@/components/PlatformIcon";
import { PostStatusBadge } from "@/components/posts/PostStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Post } from "@/types";

export function PostCard({ post }: { post: Post }) {
  return (
    <Link to={`/posts/${post.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            {post.media_type === "video" ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{post.content || "(No text content)"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PostStatusBadge status={post.status} />
              <span className="text-xs text-muted-foreground">
                {post.publish_date ? formatDate(post.publish_date) : formatDate(post.created_at)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {post.platforms.map((p) => (
              <PlatformIcon key={p.id} platform={p.platform} />
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
