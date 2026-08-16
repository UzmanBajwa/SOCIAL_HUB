import { Globe2, MessageCircle, Repeat2, Send, ThumbsUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { MediaItem } from "@/types";

export function LinkedInPreview({
  pageName,
  pageAvatarUrl,
  content,
  media,
}: {
  pageName: string;
  pageAvatarUrl?: string | null;
  content: string;
  media: MediaItem[];
}) {
  const firstMedia = media[0];

  return (
    <div className="mx-auto max-w-lg overflow-hidden rounded-lg border border-border bg-white text-black shadow-sm">
      <div className="flex items-start gap-2.5 p-3">
        <Avatar className="h-12 w-12 rounded-md">
          <AvatarImage src={pageAvatarUrl ?? undefined} alt={pageName} />
          <AvatarFallback className="rounded-md">{initials(pageName || "Page")}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{pageName || "Your Company Page"}</p>
          <p className="truncate text-xs text-gray-500">Company Page &middot; 1,204 followers</p>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Just now</span>
            <span>&middot;</span>
            <Globe2 className="h-3 w-3" />
          </div>
        </div>
      </div>

      {content && <p className="whitespace-pre-wrap px-3 pb-3 text-sm leading-snug">{content}</p>}

      {firstMedia && (
        <div className={cn("bg-gray-100", media.length > 1 ? "grid grid-cols-2 gap-0.5" : "")}>
          {media.slice(0, 2).map((item, index) => (
            <div key={item.url + index} className="relative aspect-video overflow-hidden">
              {item.type === "video" ? (
                <video src={item.url} className="h-full w-full object-cover" />
              ) : (
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="flex -space-x-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">
              👍
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
              ❤
            </span>
          </span>
          0
        </span>
        <span>0 comments</span>
      </div>

      <div className="grid grid-cols-4 divide-x divide-gray-200 border-t border-gray-200 text-xs font-medium text-gray-600">
        <button type="button" className="flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50">
          <ThumbsUp className="h-4 w-4" /> Like
        </button>
        <button type="button" className="flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50">
          <MessageCircle className="h-4 w-4" /> Comment
        </button>
        <button type="button" className="flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50">
          <Repeat2 className="h-4 w-4" /> Repost
        </button>
        <button type="button" className="flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50">
          <Send className="h-4 w-4" /> Send
        </button>
      </div>
    </div>
  );
}
