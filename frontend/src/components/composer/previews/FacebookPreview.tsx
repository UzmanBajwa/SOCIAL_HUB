import { Globe, MapPin, MessageCircle, Share2, ThumbsUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { MediaItem, PostLocation } from "@/types";

export function FacebookPreview({
  pageName,
  pageAvatarUrl,
  content,
  media,
  location,
  view,
}: {
  pageName: string;
  pageAvatarUrl?: string | null;
  content: string;
  media: MediaItem[];
  location: PostLocation | null;
  view: "desktop" | "mobile";
}) {
  return (
    <div className={cn("mx-auto", view === "mobile" ? "max-w-sm" : "max-w-lg")}>
      <div className="overflow-hidden rounded-lg border border-border bg-white text-black shadow-sm">
        <div className="flex items-center gap-2.5 p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={pageAvatarUrl ?? undefined} alt={pageName} />
            <AvatarFallback>{initials(pageName || "Page")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{pageName || "Your Page"}</p>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>Just now</span>
              {location && (
                <>
                  <span>&middot;</span>
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{location.name}</span>
                </>
              )}
              <span>&middot;</span>
              <Globe className="h-3 w-3" />
            </div>
          </div>
        </div>

        {content && <p className="whitespace-pre-wrap px-3 pb-3 text-sm leading-snug">{content}</p>}

        {media.length > 0 && (
          <div className={cn("grid gap-0.5 bg-gray-100", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {media.slice(0, 4).map((item, index) => (
              <div key={item.url + index} className="relative aspect-square overflow-hidden">
                {item.type === "video" ? (
                  <video src={item.url} className="h-full w-full object-cover" />
                ) : (
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                )}
                {index === 3 && media.length > 4 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
                    +{media.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 px-2 py-1 text-xs text-gray-500">
          <span>👍 0</span>
          <span>0 comments &middot; 0 shares</span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 text-sm font-medium text-gray-600">
          <button type="button" className="flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50">
            <ThumbsUp className="h-4 w-4" /> Like
          </button>
          <button type="button" className="flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50">
            <MessageCircle className="h-4 w-4" /> Comment
          </button>
          <button type="button" className="flex items-center justify-center gap-1.5 py-2 hover:bg-gray-50">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
