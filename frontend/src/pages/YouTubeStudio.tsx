import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Youtube } from "lucide-react";

import { fetchAccounts } from "@/api/accounts";
import { createPost } from "@/api/posts";
import {
  cancelYouTubeUpload,
  initYouTubeUpload,
  publishYouTubeUpload,
  setYouTubeThumbnail,
  uploadYouTubeVideo,
} from "@/api/youtube";
import { YouTubeAdvancedSection } from "@/components/youtube/YouTubeAdvancedSection";
import { YouTubeAudienceSection } from "@/components/youtube/YouTubeAudienceSection";
import { YouTubeDetailsSection } from "@/components/youtube/YouTubeDetailsSection";
import { YouTubePlaylistsSection, type SelectedYouTubePlaylist } from "@/components/youtube/YouTubePlaylistsSection";
import { YouTubePublishBar } from "@/components/youtube/YouTubePublishBar";
import { YouTubeStudioHeader } from "@/components/youtube/YouTubeStudioHeader";
import { YouTubeStudioSidebar } from "@/components/youtube/YouTubeStudioSidebar";
import { YouTubeTagsSection } from "@/components/youtube/YouTubeTagsSection";
import { YouTubeUploadSection } from "@/components/youtube/YouTubeUploadSection";
import type { StudioStatus } from "@/components/youtube/StudioStatusPill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import type { Media, Post, SocialAccount, YouTubePrivacy } from "@/types";

export default function YouTubeStudio() {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });
  const youtubeAccounts = (accounts ?? []).filter((a) => a.platform === "youtube");
  const [accountId, setAccountId] = useState<string>("");

  useEffect(() => {
    if (!accountId && youtubeAccounts.length) setAccountId(youtubeAccounts[0].id);
  }, [accountId, youtubeAccounts]);

  const account: SocialAccount | undefined = youtubeAccounts.find((a) => a.id === accountId);

  // --- video file + preview ---
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StudioStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);

  // --- details ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [privacy, setPrivacy] = useState<YouTubePrivacy>("public");
  const [madeForKids, setMadeForKids] = useState<boolean | null>(null);
  const [thumbnail, setThumbnail] = useState<Media | null>(null);
  const [selectedPlaylists, setSelectedPlaylists] = useState<SelectedYouTubePlaylist[]>([]);

  useEffect(() => {
    // Playlist ids belong to a channel, so selections never survive an account switch.
    setSelectedPlaylists([]);
  }, [accountId]);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setObjectUrl(null);
  }, [file]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const resetFile = useCallback(() => {
    setFile(null);
    setUploadId(null);
    setVideoId(null);
    setPost(null);
    setProgress(0);
    setSpeed(null);
    setDuration(null);
    setErrorMsg(null);
  }, []);

  const handleFileSelect = useCallback((selected: File) => {
    setFile(selected);
    setStatus("selected");
    setErrorMsg(null);
  }, []);

  const handleCancel = useCallback(async () => {
    if (status === "uploading" && uploadId) {
      abortRef.current?.abort();
      try {
        await cancelYouTubeUpload(uploadId);
      } catch {
        // best-effort: the upload row may have already ended
      }
      setStatus("cancelled");
      toast({ title: "Upload cancelled" });
    } else if (status === "selected") {
      resetFile();
      setStatus("idle");
    }
  }, [status, uploadId, resetFile]);

  const handleUpload = useCallback(async () => {
    if (!file || !account) return;
    if (!title.trim()) {
      toast({ title: "Add a title before publishing", variant: "destructive" });
      return;
    }
    if (madeForKids === null) {
      toast({
        title: "Select the video audience",
        description: "Please indicate whether this video is made for kids before publishing.",
        variant: "destructive",
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("uploading");
    setProgress(0);
    setSpeed(null);
    setErrorMsg(null);
    setPost(null);

    try {
      const init = await initYouTubeUpload({
        account_id: account.id,
        total_size: file.size,
        title: title.trim(),
        description: description.trim() || null,
        privacy_status: privacy,
        tags: tags.length ? tags : undefined,
        category: category || undefined,
        made_for_kids: madeForKids,
        thumbnail_url: thumbnail?.file_url ?? null,
      });
      setUploadId(init.upload_id);

      let lastAt = performance.now();
      let lastPct = 0;
      const onProgress = (pct: number) => {
        const now = performance.now();
        const dt = (now - lastAt) / 1000;
        if (dt > 0) {
          const bytesPerSec = ((pct - lastPct) / 100) * file.size * (1 / dt);
          if (bytesPerSec > 0) {
            setSpeed(
              bytesPerSec >= 1024 * 1024
                ? `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
                : `${Math.round(bytesPerSec / 1024)} KB/s`
            );
          }
        }
        lastAt = now;
        lastPct = pct;
        setProgress(pct);
      };

      const uploaded = await uploadYouTubeVideo(
        init.upload_id,
        file,
        onProgress,
        false,
        controller.signal
      );
      if (uploaded.status !== "uploaded" || !uploaded.video_id) {
        throw new Error(uploaded.error || "The upload did not complete.");
      }
      setVideoId(uploaded.video_id);

      setStatus("processing");
      const minProcessing = new Promise((resolve) => setTimeout(resolve, 2200));

      if (thumbnail) {
        try {
          await setYouTubeThumbnail(init.upload_id, thumbnail.id);
        } catch (error) {
          toast({
            title: "Thumbnail was not attached",
            description: getApiErrorMessage(error),
            variant: "destructive",
          });
        }
      }

      const published = await publishYouTubeUpload(init.upload_id, {
        playlist_ids: selectedPlaylists.map((playlist) => playlist.playlist_id),
      });
      await minProcessing;

      setPost(published.post);
      setStatus("completed");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({
        title: "Video published to YouTube",
        variant: "success",
      });

      // Playlist association is best-effort: the video is already published, so a
      // playlist failure is surfaced as a non-blocking warning, never an error.
      const failedPlaylists = published.playlist_results.filter((result) => !result.success);
      if (failedPlaylists.length > 0) {
        for (const result of failedPlaylists) {
          const title =
            selectedPlaylists.find((s) => s.playlist_id === result.playlist_id)?.title ??
            "playlist";
          toast({
            title: `WARNING — Could not add to "${title}"`,
            description: result.error ?? undefined,
          });
        }
      } else if (published.playlist_results.length > 0) {
        toast({ title: "Video added to selected playlists", variant: "success" });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("cancelled");
        return;
      }
      setStatus("failed");
      setErrorMsg(getApiErrorMessage(error, "Upload failed."));
    }
  }, [account, file, title, description, privacy, tags, category, madeForKids, thumbnail, selectedPlaylists, queryClient]);

  const handleSaveDraft = useCallback(async () => {
    if (!account) return;
    if (!title.trim()) {
      toast({ title: "Add a title before saving", variant: "destructive" });
      return;
    }
    try {
      await createPost({
        content: title.trim(),
        media_type: "video",
        thumbnail_url: thumbnail?.file_url ?? null,
        platform_options: {
          video_id: videoId ?? null,
          upload_id: uploadId ?? null,
          privacy,
          tags,
          category: category || null,
          made_for_kids: madeForKids ?? false,
          description: description.trim(),
        },
        platform_account_ids: [account.id],
      });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Draft saved", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not save draft",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  }, [account, title, thumbnail, videoId, uploadId, privacy, tags, category, madeForKids, description, queryClient]);

  const busy = status === "uploading" || status === "processing";
  const canPublish = Boolean(file) && !busy;

  if (accountsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!youtubeAccounts.length) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <Youtube className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Connect a YouTube channel to get started</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            YouTube Studio lets you upload videos with full control over title, description,
            tags, category, visibility and thumbnails.
          </p>
        </div>
        <Button asChild>
          <Link to="/accounts">Connect YouTube</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <YouTubeStudioHeader
        accounts={youtubeAccounts}
        account={account}
        disabled={busy}
        onAccountChange={setAccountId}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <YouTubeUploadSection
            file={file}
            objectUrl={objectUrl}
            status={status}
            progress={progress}
            speed={speed}
            errorMsg={errorMsg}
            videoId={videoId}
            post={post}
            duration={duration}
            onDuration={setDuration}
            onFileSelect={handleFileSelect}
            onRemove={() => {
              resetFile();
              setStatus("idle");
            }}
            onCancel={handleCancel}
            onRetry={handleUpload}
            disabled={busy}
          />

          <YouTubeDetailsSection
            title={title}
            description={description}
            category={category}
            thumbnail={thumbnail}
            disabled={busy}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onCategoryChange={setCategory}
            onThumbnail={setThumbnail}
            onThumbnailRemove={() => setThumbnail(null)}
          />

          <YouTubeAudienceSection
            madeForKids={madeForKids}
            disabled={busy}
            onChange={setMadeForKids}
          />

          <YouTubeTagsSection tags={tags} disabled={busy} onChange={setTags} />

          <YouTubePlaylistsSection
            account={account}
            selected={selectedPlaylists}
            onChange={setSelectedPlaylists}
            disabled={busy}
          />

          <YouTubeAdvancedSection />
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <YouTubeStudioSidebar
            file={file}
            objectUrl={objectUrl}
            videoId={videoId}
            post={post}
            privacy={privacy}
            status={status}
            progress={progress}
            speed={speed}
            account={account}
            disabled={busy}
            onPrivacyChange={setPrivacy}
          />
        </aside>
      </div>

      <YouTubePublishBar
        file={file}
        status={status}
        privacy={privacy}
        busy={busy}
        canPublish={canPublish}
        onPublish={handleUpload}
        onSaveDraft={handleSaveDraft}
        onCancel={handleCancel}
      />
    </div>
  );
}
