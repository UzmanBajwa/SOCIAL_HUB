import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { fetchAccounts } from "@/api/accounts";
import { createPost, fetchPost, publishPost, schedulePost, updatePost, type CreatePostPayload } from "@/api/posts";
import { AIAssistantMenu } from "@/components/composer/AIAssistantMenu";
import { FacebookOptions } from "@/components/composer/FacebookOptions";
import { LinkedInOptions } from "@/components/composer/LinkedInOptions";
import { LocationPicker } from "@/components/composer/LocationPicker";
import { MediaUploader } from "@/components/composer/MediaUploader";
import { MentionSelector } from "@/components/composer/MentionSelector";
import { PostPreview } from "@/components/composer/PostPreview";
import { PublishingModal } from "@/components/composer/PublishingModal";
import { SchedulePicker } from "@/components/composer/SchedulePicker";
import { WhatsAppStatus } from "@/components/composer/WhatsAppStatus";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PlatformSelector } from "@/components/posts/PlatformSelector";
import { PostStatusBadge } from "@/components/posts/PostStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { BROWSER_TIMEZONE, utcIsoToZonedParts, zonedTimeToUtcIso } from "@/lib/timezone";
import { formatDate } from "@/lib/utils";
import type { Mention, MediaItem, PostLocation } from "@/types";

const CONTENT_MAX_LENGTH = 10000;

export default function CreatePost() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [publishAsReel, setPublishAsReel] = useState(false);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [location, setLocation] = useState<PostLocation | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState(BROWSER_TIMEZONE);
  const [postId, setPostId] = useState<string | undefined>(id);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const { data: existingPost, isLoading: isLoadingPost } = useQuery({
    queryKey: ["posts", id],
    queryFn: () => fetchPost(id!),
    enabled: isEditing,
  });

  // YouTube videos use their own Studio uploader (full title/description/tags/category/
  // visibility control + resumable streaming), so YouTube channels are excluded from the
  // multi-platform composer to avoid a re-upload through the generic pipeline.
  const composerAccounts = (accounts ?? []).filter((a) => a.platform !== "youtube");

  useEffect(() => {
    if (existingPost) {
      setContent(existingPost.content);
      setMediaItems(
        existingPost.media_items ?? (existingPost.media_url ? [{ url: existingPost.media_url, type: existingPost.media_type! }] : [])
      );
      setThumbnailUrl(existingPost.thumbnail_url);
      setShareToFeed(existingPost.share_to_feed);
      setIsPinned(existingPost.is_pinned);
      setPublishAsReel(existingPost.publish_as_reel);
      setMentions(existingPost.mentions ?? []);
      setLocation(existingPost.location);
      setSelectedAccountIds(
        existingPost.platforms.filter((p) => p.platform !== "youtube").map((p) => p.social_account_id)
      );
      if (existingPost.publish_date) {
        setScheduleEnabled(true);
        const tz = existingPost.timezone ?? BROWSER_TIMEZONE;
        const { date, time } = utcIsoToZonedParts(existingPost.publish_date, tz);
        setScheduleTimezone(tz);
        setScheduleDate(date);
        setScheduleTime(time);
      }
    }
  }, [existingPost]);

  useEffect(() => {
    const prefill = (routerLocation.state as { prefillContent?: string } | null)?.prefillContent;
    if (!isEditing && prefill) {
      setContent(prefill);
      navigate(routerLocation.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isReadOnly = existingPost ? !["draft", "scheduled"].includes(existingPost.status) : false;
  const mediaType = mediaItems[0]?.type ?? null;
  const selectedAccounts = composerAccounts.filter((a) => selectedAccountIds.includes(a.id));
  const selectedFacebookAccount = selectedAccounts.find((a) => a.platform === "facebook") ?? null;
  const selectedLinkedInAccount = selectedAccounts.find((a) => a.platform === "linkedin") ?? null;
  const hasInstagramSelected = selectedAccounts.some((a) => a.platform === "instagram");
  const linkedInCarouselBlocked = Boolean(selectedLinkedInAccount) && mediaItems.length > 1;
  const publishTargets = selectedAccounts.map((a) => ({
    accountId: a.id,
    platform: a.platform,
    accountName: a.account_name,
  }));

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((existing) => existing !== accountId) : [...prev, accountId]
    );
  }

  function handleMentionSelect(mention: Mention) {
    setContent((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@[${mention.name}] `);
    setMentions((prev) => (prev.some((m) => m.id === mention.id) ? prev : [...prev, mention]));
  }

  function buildPayload(publishDateIso?: string | null): CreatePostPayload {
    return {
      content,
      media_url: mediaItems[0]?.url ?? null,
      media_type: mediaItems[0]?.type ?? null,
      media_items: mediaItems.length ? mediaItems : null,
      thumbnail_url: mediaType === "video" ? thumbnailUrl : null,
      share_to_feed: shareToFeed,
      is_pinned: isPinned,
      publish_as_reel: publishAsReel,
      mentions: mentions.length ? mentions : null,
      location,
      timezone: scheduleEnabled ? scheduleTimezone : null,
      platform_account_ids: selectedAccountIds.filter((id) =>
        composerAccounts.some((account) => account.id === id)
      ),
      publish_date: publishDateIso ?? null,
    };
  }

  async function ensurePostSaved(publishDateIso?: string | null): Promise<string> {
    if (postId) {
      await updatePost(postId, buildPayload(publishDateIso));
      return postId;
    }
    const post = await createPost(buildPayload(publishDateIso));
    setPostId(post.id);
    return post.id;
  }

  const saveDraftMutation = useMutation({
    mutationFn: async () => ensurePostSaved(null),
    onSuccess: () => {
      toast({ title: "Draft saved", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate("/posts");
    },
    onError: (error) => toast({ title: "Could not save draft", description: getApiErrorMessage(error), variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const savedId = await ensurePostSaved(null);
      return publishPost(savedId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function handlePublishNow() {
    setPublishModalOpen(true);
    publishMutation.mutate();
  }

  function closePublishModal() {
    setPublishModalOpen(false);
    if (publishMutation.isSuccess) {
      navigate("/posts");
    }
  }

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const isoDate = zonedTimeToUtcIso(scheduleDate, scheduleTime, scheduleTimezone);
      const savedId = await ensurePostSaved(isoDate);
      return schedulePost(savedId, isoDate);
    },
    onSuccess: () => {
      toast({ title: "Post scheduled", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/posts");
    },
    onError: (error) => toast({ title: "Could not schedule", description: getApiErrorMessage(error), variant: "destructive" }),
  });

  const isBusy = saveDraftMutation.isPending || publishMutation.isPending || scheduleMutation.isPending;
  const requiresMediaForInstagram = !mediaItems.length && hasInstagramSelected;
  const canSubmit =
    (content.trim().length > 0 || mediaItems.length > 0) &&
    selectedAccountIds.length > 0 &&
    !requiresMediaForInstagram &&
    !linkedInCarouselBlocked &&
    content.length <= CONTENT_MAX_LENGTH;
  const canSchedule = canSubmit && Boolean(scheduleDate && scheduleTime);

  if (isEditing && isLoadingPost) {
    return <p className="text-sm text-muted-foreground">Loading post...</p>;
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isEditing ? "Edit post" : "Create post"}</h1>
          <p className="text-sm text-muted-foreground">Compose once, publish everywhere.</p>
        </div>
        {existingPost && <PostStatusBadge status={existingPost.status} />}
      </div>

      {isReadOnly && existingPost && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Publishing results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {existingPost.platforms.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={p.platform} />
                  <div>
                    <p className="text-sm font-medium capitalize">{p.platform}</p>
                    {p.error_message && <p className="text-xs text-destructive">{p.error_message}</p>}
                    {p.published_at && (
                      <p className="text-xs text-muted-foreground">Published {formatDate(p.published_at)}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium capitalize text-muted-foreground">{p.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Content</CardTitle>
              <AIAssistantMenu text={content} onResult={setContent} disabled={isReadOnly} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  placeholder="What do you want to share?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={isReadOnly}
                  rows={6}
                />
                <p
                  className={`mt-1 text-right text-xs ${
                    content.length > CONTENT_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {content.length.toLocaleString()} / {CONTENT_MAX_LENGTH.toLocaleString()}
                </p>
              </div>

              <MediaUploader items={mediaItems} onChange={setMediaItems} disabled={isReadOnly} hasInstagramSelected={hasInstagramSelected} />
            </CardContent>
          </Card>

          {selectedFacebookAccount && !isReadOnly && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Mentions &amp; Location</CardTitle>
                <CardDescription>Tag other Pages or attach a location to this post.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MentionSelector
                  accountId={selectedFacebookAccount.id}
                  mentions={mentions}
                  onSelect={handleMentionSelect}
                  onRemove={(mentionId) => setMentions((prev) => prev.filter((m) => m.id !== mentionId))}
                />
                <LocationPicker
                  accountId={selectedFacebookAccount.id}
                  location={location}
                  onSelect={setLocation}
                  onClear={() => setLocation(null)}
                />
              </CardContent>
            </Card>
          )}

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              <PlatformSelector
                accounts={composerAccounts}
                selectedIds={selectedAccountIds}
                onToggle={isReadOnly ? () => {} : toggleAccount}
              />
              {requiresMediaForInstagram && (
                <p className="mt-3 text-sm text-destructive">
                  Instagram requires an image or video &mdash; add media above or deselect Instagram.
                </p>
              )}
            </CardContent>
          </Card>

          {mediaType === "video" && hasInstagramSelected && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Instagram Reel options</CardTitle>
                <CardDescription>This video will publish to Instagram as a Reel.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <Label htmlFor="ig-share-to-feed">Also share to Instagram feed</Label>
                  <p className="text-xs text-muted-foreground">Also appears in the main feed grid, not just Reels.</p>
                </div>
                <Switch id="ig-share-to-feed" checked={shareToFeed} onCheckedChange={setShareToFeed} disabled={isReadOnly} />
              </CardContent>
            </Card>
          )}

          {selectedFacebookAccount && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Facebook options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FacebookOptions
                  mediaType={mediaType}
                  isPinned={isPinned}
                  onIsPinnedChange={setIsPinned}
                  publishAsReel={publishAsReel}
                  onPublishAsReelChange={setPublishAsReel}
                  disabled={isReadOnly}
                />
                <WhatsAppStatus account={selectedFacebookAccount} />
              </CardContent>
            </Card>
          )}

          {selectedLinkedInAccount && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">LinkedIn options</CardTitle>
              </CardHeader>
              <CardContent>
                <LinkedInOptions account={selectedLinkedInAccount} mediaItemCount={mediaItems.length} />
              </CardContent>
            </Card>
          )}

          {!isReadOnly && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => {
                      setScheduleEnabled(e.target.checked);
                      if (e.target.checked && !scheduleDate) {
                        setScheduleDate(todayStr);
                        setScheduleTime("12:00");
                      }
                    }}
                    className="h-4 w-4 rounded border-input"
                  />
                  Schedule for later
                </label>
                {scheduleEnabled && (
                  <SchedulePicker
                    date={scheduleDate}
                    time={scheduleTime}
                    timezone={scheduleTimezone}
                    minDate={todayStr}
                    onDateChange={setScheduleDate}
                    onTimeChange={setScheduleTime}
                    onTimezoneChange={setScheduleTimezone}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {!isReadOnly && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={isBusy}>
                Save draft
              </Button>
              {scheduleEnabled ? (
                <Button
                  onClick={() => scheduleMutation.mutate()}
                  disabled={isBusy || !canSchedule}
                  className="gap-1.5"
                >
                  {scheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  Schedule
                </Button>
              ) : (
                <Button onClick={handlePublishNow} disabled={isBusy || !canSubmit} className="gap-1.5">
                  {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publish now
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-emerald-400" />
                Live preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gradient-to-b from-black/40 to-black/10 p-4 dark:from-black/60 dark:to-black/20">
                {selectedAccounts.length ? (
                  <PostPreview accounts={selectedAccounts} content={content} media={mediaItems} location={location} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Select a platform to see a live preview.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PublishingModal
        open={publishModalOpen}
        targets={publishTargets}
        isPending={publishMutation.isPending}
        isError={publishMutation.isError}
        errorMessage={publishMutation.isError ? getApiErrorMessage(publishMutation.error) : null}
        result={publishMutation.data ?? null}
        onClose={closePublishModal}
      />
    </div>
  );
}
