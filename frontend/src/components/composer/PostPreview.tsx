import { Laptop, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FacebookPreview } from "@/components/composer/previews/FacebookPreview";
import { InstagramPreview } from "@/components/composer/previews/InstagramPreview";
import { LinkedInPreview } from "@/components/composer/previews/LinkedInPreview";
import { PlatformIcon } from "@/components/PlatformIcon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLATFORM_LABELS, type MediaItem, type Platform, type PostLocation, type SocialAccount } from "@/types";

interface PostPreviewProps {
  accounts: SocialAccount[];
  content: string;
  media: MediaItem[];
  location: PostLocation | null;
}

const PLATFORM_ORDER: Platform[] = ["facebook", "instagram", "linkedin", "youtube"];

export function PostPreview({ accounts, content, media, location }: PostPreviewProps) {
  const byPlatform = useMemo(() => {
    const map = new Map<Platform, SocialAccount>();
    for (const account of accounts) {
      if (!map.has(account.platform)) map.set(account.platform, account);
    }
    return map;
  }, [accounts]);

  const availablePlatforms = PLATFORM_ORDER.filter((p) => byPlatform.has(p));
  const [activePlatform, setActivePlatform] = useState<Platform>(availablePlatforms[0] ?? "facebook");
  const [view, setView] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (availablePlatforms.length && !availablePlatforms.includes(activePlatform)) {
      setActivePlatform(availablePlatforms[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePlatforms.join(",")]);

  if (!availablePlatforms.length) return null;

  const account = byPlatform.get(activePlatform)!;

  return (
    <div className="space-y-3">
      {availablePlatforms.length > 1 && (
        <Tabs value={activePlatform} onValueChange={(v) => setActivePlatform(v as Platform)}>
          <TabsList>
            {availablePlatforms.map((platform) => (
              <TabsTrigger key={platform} value={platform} className="gap-1.5">
                <PlatformIcon platform={platform} className="h-4 w-4 bg-transparent p-0" />
                {PLATFORM_LABELS[platform]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {activePlatform === "facebook" && (
        <Tabs value={view} onValueChange={(v) => setView(v as "desktop" | "mobile")}>
          <TabsList>
            <TabsTrigger value="desktop" className="gap-1.5">
              <Laptop className="h-3.5 w-3.5" />
              Desktop
            </TabsTrigger>
            <TabsTrigger value="mobile" className="gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {activePlatform === "facebook" && (
        <FacebookPreview
          pageName={account.account_name}
          pageAvatarUrl={account.avatar_url}
          content={content}
          media={media}
          location={location}
          view={view}
        />
      )}

      {activePlatform === "instagram" && (
        <InstagramPreview
          pageName={account.account_username ?? account.account_name}
          pageAvatarUrl={account.avatar_url}
          content={content}
          media={media}
          location={location}
        />
      )}

      {activePlatform === "linkedin" && (
        <LinkedInPreview
          pageName={account.account_name}
          pageAvatarUrl={account.avatar_url}
          content={content}
          media={media}
        />
      )}
    </div>
  );
}
