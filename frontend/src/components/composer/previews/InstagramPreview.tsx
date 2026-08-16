import { Bookmark, Heart, MapPin, MessageCircle, Send } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import type { MediaItem, PostLocation } from "@/types";

export function InstagramPreview({
  pageName,
  pageAvatarUrl,
  content,
  media,
  location,
}: {
  pageName: string;
  pageAvatarUrl?: string | null;
  content: string;
  media: MediaItem[];
  location: PostLocation | null;
}) {
  const firstMedia = media[0];

  return (
    <div className="mx-auto max-w-[280px] overflow-hidden rounded-[1.75rem] border-[6px] border-black bg-white text-black shadow-lg">
      <div className="flex items-center justify-between px-3 pt-1.5 text-[10px] font-medium">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-black" />
          <div className="h-1.5 w-3 rounded-sm bg-black" />
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5">
        <Avatar className="h-7 w-7 ring-2 ring-pink-500/70 ring-offset-1">
          <AvatarImage src={pageAvatarUrl ?? undefined} alt={pageName} />
          <AvatarFallback className="text-[10px]">{initials(pageName || "IG")}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold leading-tight">{pageName || "your_account"}</p>
          {location && (
            <p className="flex items-center gap-0.5 truncate text-[10px] text-gray-500">
              <MapPin className="h-2.5 w-2.5" />
              {location.name}
            </p>
          )}
        </div>
        <span className="text-lg leading-none text-gray-500">&middot;&middot;&middot;</span>
      </div>

      <div className="relative aspect-square w-full bg-gray-100">
        {firstMedia ? (
          firstMedia.type === "video" ? (
            <video src={firstMedia.url} className="h-full w-full object-cover" />
          ) : (
            <img src={firstMedia.url} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No media yet</div>
        )}
        {media.length > 1 && (
          <div className="absolute right-2 top-2 flex gap-0.5">
            {media.slice(0, 5).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/90 shadow" />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2.5 py-2">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>
        <Bookmark className="h-5 w-5" />
      </div>

      <div className="px-2.5 pb-3 text-xs leading-snug">
        <p className="font-semibold">0 likes</p>
        {content && (
          <p className="mt-0.5 whitespace-pre-wrap">
            <span className="font-semibold">{pageName || "your_account"}</span> {content}
          </p>
        )}
      </div>
    </div>
  );
}
