import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Image as ImageIcon, Loader2, Send, Upload, X } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { fetchAccounts } from "@/api/accounts";
import { uploadMedia } from "@/api/media";
import {
  createPost,
  fetchPost,
  publishPost,
  schedulePost,
  updatePost,
  type CreatePostPayload,
} from "@/api/posts";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PlatformSelector } from "@/components/posts/PlatformSelector";
import { PostStatusBadge } from "@/components/posts/PostStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function CreatePost() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [thumbnailUploadProgress, setThumbnailUploadProgress] = useState<number | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [postId, setPostId] = useState<string | undefined>(id);

  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const { data: existingPost, isLoading: isLoadingPost } = useQuery({
    queryKey: ["posts", id],
    queryFn: () => fetchPost(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingPost) {
      setContent(existingPost.content);
      setMediaUrl(existingPost.media_url);
      setMediaType(existingPost.media_type);
      setThumbnailUrl(existingPost.thumbnail_url);
      setShareToFeed(existingPost.share_to_feed);
      setSelectedAccountIds(existingPost.platforms.map((p) => p.social_account_id));
      if (existingPost.publish_date) {
        setScheduleEnabled(true);
        setScheduleDate(toLocalDatetimeInputValue(existingPost.publish_date));
      }
    }
  }, [existingPost]);

  const isReadOnly = existingPost ? !["draft", "scheduled"].includes(existingPost.status) : false;

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    try {
      const media = await uploadMedia(file, setUploadProgress);
      setMediaUrl(media.file_url);
      setMediaType(media.type);
    } catch (error) {
      toast({ title: "Upload failed", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setUploadProgress(null);
    }
  }

  async function handleThumbnailChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailUploadProgress(0);
    try {
      const media = await uploadMedia(file, setThumbnailUploadProgress);
      setThumbnailUrl(media.file_url);
    } catch (error) {
      toast({ title: "Cover upload failed", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setThumbnailUploadProgress(null);
    }
  }

  function buildPayload(publishDate?: string | null): CreatePostPayload {
    return {
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      thumbnail_url: mediaType === "video" ? thumbnailUrl : null,
      share_to_feed: shareToFeed,
      platform_account_ids: selectedAccountIds,
      publish_date: publishDate ?? null,
    };
  }

  async function ensurePostSaved(publishDate?: string | null): Promise<string> {
    if (postId) {
      await updatePost(postId, buildPayload(publishDate));
      return postId;
    }
    const post = await createPost(buildPayload(publishDate));
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
      toast({ title: "Post published", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/posts");
    },
    onError: (error) => toast({ title: "Publish failed", description: getApiErrorMessage(error), variant: "destructive" }),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const isoDate = new Date(scheduleDate).toISOString();
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
  const requiresMediaForInstagram =
    !mediaUrl && (accounts ?? []).some((a) => selectedAccountIds.includes(a.id) && a.platform === "instagram");
  const showReelOptions =
    mediaType === "video" && (accounts ?? []).some((a) => selectedAccountIds.includes(a.id) && a.platform === "instagram");
  const canSubmit =
    (content.trim().length > 0 || Boolean(mediaUrl)) && selectedAccountIds.length > 0 && !requiresMediaForInstagram;

  if (isEditing && isLoadingPost) {
    return <p className="text-sm text-muted-foreground">Loading post...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isEditing ? "Edit post" : "Create post"}</h1>
          <p className="text-sm text-muted-foreground">Compose once, publish everywhere.</p>
        </div>
        {existingPost && <PostStatusBadge status={existingPost.status} />}
      </div>

      {isReadOnly && existingPost && (
        <Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="What do you want to share?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isReadOnly}
            rows={6}
          />

          {mediaUrl ? (
            <div className="relative w-fit">
              {mediaType === "video" ? (
                <video src={mediaUrl} className="max-h-64 rounded-lg border border-border" controls />
              ) : (
                <img src={mediaUrl} alt="Upload preview" className="max-h-64 rounded-lg border border-border" />
              )}
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setMediaUrl(null);
                    setMediaType(null);
                  }}
                  className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            !isReadOnly && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-accent">
                {uploadProgress !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Upload image or video
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploadProgress !== null}
                />
              </label>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformSelector
            accounts={accounts ?? []}
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

      {showReelOptions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4" />
              Reel options
            </CardTitle>
            <CardDescription>This video will publish to Instagram as a Reel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="share-to-feed">Also share to Instagram feed</Label>
                <p className="text-xs text-muted-foreground">
                  When on, the Reel also appears in the main feed grid, not just the Reels tab.
                </p>
              </div>
              <Switch
                id="share-to-feed"
                checked={shareToFeed}
                onCheckedChange={setShareToFeed}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cover image (optional)</Label>
              {thumbnailUrl ? (
                <div className="relative w-fit">
                  <img src={thumbnailUrl} alt="Cover preview" className="h-32 rounded-lg border border-border object-cover" />
                  {!isReadOnly && (
                    <button
                      onClick={() => setThumbnailUrl(null)}
                      className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                !isReadOnly && (
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent">
                    {thumbnailUploadProgress !== null ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Uploading {thumbnailUploadProgress}%
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> Upload a cover image
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleThumbnailChange}
                      disabled={thumbnailUploadProgress !== null}
                    />
                  </label>
                )
              )}
              <p className="text-xs text-muted-foreground">
                If skipped, Instagram picks a frame from the video automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isReadOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Schedule for later
            </label>
            {scheduleEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="scheduleDate">Publish date &amp; time</Label>
                <Input
                  id="scheduleDate"
                  type="datetime-local"
                  value={scheduleDate}
                  min={toLocalDatetimeInputValue(new Date().toISOString())}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
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
              disabled={isBusy || !canSubmit || !scheduleDate}
              className="gap-1.5"
            >
              {scheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              Schedule
            </Button>
          ) : (
            <Button onClick={() => publishMutation.mutate()} disabled={isBusy || !canSubmit} className="gap-1.5">
              {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish now
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function toLocalDatetimeInputValue(isoDate: string): string {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
