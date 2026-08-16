import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ListPlus,
  ListVideo,
  Loader2,
  Lock,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";

import { createYouTubePlaylist, fetchYouTubePlaylists } from "@/api/youtube";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SocialAccount, YouTubePlaylist, YouTubePrivacy } from "@/types";
import { StudioSectionCard } from "./StudioSectionCard";

export const YOUTUBE_PLAYLIST_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

export interface SelectedYouTubePlaylist {
  playlist_id: string;
  title: string;
}

interface YouTubePlaylistsSectionProps {
  account: SocialAccount | undefined;
  disabled?: boolean;
  selected: SelectedYouTubePlaylist[];
  onChange: (next: SelectedYouTubePlaylist[]) => void;
}

const CREATE_TITLE_MAX = 150;
const CREATE_DESCRIPTION_MAX = 5000;

export function YouTubePlaylistsSection({
  account,
  disabled,
  selected,
  onChange,
}: YouTubePlaylistsSectionProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPrivacy, setCreatePrivacy] = useState<YouTubePrivacy>("public");

  const accountId = account?.id;
  const needsReconnect = Boolean(
    account && !(account.scopes ?? []).includes(YOUTUBE_PLAYLIST_SCOPE)
  );

  const playlistsQuery = useQuery({
    queryKey: ["youtube-playlists", accountId],
    queryFn: () => fetchYouTubePlaylists(accountId as string),
    enabled: Boolean(accountId) && open,
    staleTime: 5 * 60 * 1000,
  });

  const playlists = useMemo(() => playlistsQuery.data ?? [], [playlistsQuery.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return playlists;
    return playlists.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        (p.description ?? "").toLowerCase().includes(query)
    );
  }, [playlists, search]);

  const togglePlaylist = (playlist: YouTubePlaylist) => {
    if (selected.some((s) => s.playlist_id === playlist.playlist_id)) {
      onChange(selected.filter((s) => s.playlist_id !== playlist.playlist_id));
    } else {
      onChange([...selected, { playlist_id: playlist.playlist_id, title: playlist.title }]);
    }
  };

  const createMutation = useMutation({
    mutationFn: createYouTubePlaylist,
    onSuccess: (playlist) => {
      queryClient.setQueryData<YouTubePlaylist[]>(["youtube-playlists", accountId], (old) => [
        playlist,
        ...(old ?? []),
      ]);
      onChange([...selected, { playlist_id: playlist.playlist_id, title: playlist.title }]);
      setShowCreate(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreatePrivacy("public");
      setSearch("");
      toast({ title: "Playlist created", variant: "success" });
    },
    onError: (error) => {
      toast({
        title: "Could not create playlist",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!accountId) return;
    if (!createTitle.trim()) {
      toast({ title: "Add a playlist title", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      account_id: accountId,
      title: createTitle.trim(),
      description: createDescription.trim() || null,
      privacy_status: createPrivacy,
    });
  };

  const listBody = (() => {
    if (playlistsQuery.isLoading) {
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-3">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (playlistsQuery.isError) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 px-4 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div>
            <p className="text-sm font-medium">Couldn't load your playlists</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {getApiErrorMessage(playlistsQuery.error)}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => playlistsQuery.refetch()}
            className="gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      );
    }

    if (playlists.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <ListVideo className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No playlists yet</p>
            <p className="mt-0.5 max-w-60 text-xs text-muted-foreground">
              Create a playlist below and it will be selected automatically for this video.
            </p>
          </div>
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <p className="rounded-xl border border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          No playlists match "{search.trim()}"
        </p>
      );
    }

    return (
      <ul className="space-y-1.5">
        {filtered.map((playlist) => {
          const isSelected = selected.some((s) => s.playlist_id === playlist.playlist_id);
          return (
            <li key={playlist.playlist_id}>
              <button
                type="button"
                onClick={() => togglePlaylist(playlist)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                  isSelected
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/70 bg-card/40 hover:bg-accent"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background/60"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{playlist.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {playlist.item_count ?? 0} videos
                  </span>
                </span>
                {playlist.privacy_status === "private" && (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Private" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  })();

  return (
    <StudioSectionCard
      title="Playlists"
      description="Add your video to one or more playlists"
      icon={<ListVideo className="h-4 w-4" />}
      badge={
        selected.length > 0 ? (
          <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
            {selected.length} selected
          </Badge>
        ) : undefined
      }
    >
      {needsReconnect && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Playlists need an extra YouTube permission that your connected account doesn't
            have yet.{" "}
            <Link to="/accounts" className="font-medium underline underline-offset-2">
              Reconnect your YouTube account
            </Link>{" "}
            to enable playlist support.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={disabled || !account}
          className="gap-1.5"
        >
          <ListPlus className="h-4 w-4" />
          {selected.length > 0 ? `Select playlists (${selected.length})` : "Select playlists"}
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((playlist) => (
            <span
              key={playlist.playlist_id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {playlist.title}
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s.playlist_id !== playlist.playlist_id))}
                disabled={disabled}
                className="text-primary/60 transition-colors hover:text-primary"
                aria-label={`Remove ${playlist.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add to playlists</DialogTitle>
            <DialogDescription>
              Select one or more playlists for this video.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search playlists"
              className="pl-9"
            />
          </div>

          <div className="min-h-40 flex-1 space-y-3 overflow-y-auto pr-1">
            {listBody}

            {!showCreate ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(true)}
                className="w-full gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Create new playlist
              </Button>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="yt-playlist-title">
                    Playlist title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="yt-playlist-title"
                    value={createTitle}
                    maxLength={CREATE_TITLE_MAX}
                    placeholder="e.g. Lecture series"
                    onChange={(e) => setCreateTitle(e.target.value)}
                    autoFocus
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {createTitle.length}/{CREATE_TITLE_MAX}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="yt-playlist-description">Description</Label>
                  <Textarea
                    id="yt-playlist-description"
                    value={createDescription}
                    maxLength={CREATE_DESCRIPTION_MAX}
                    rows={3}
                    placeholder="What is this playlist about?"
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Privacy</Label>
                  <Select
                    value={createPrivacy}
                    onValueChange={(v) => setCreatePrivacy(v as YouTubePrivacy)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="unlisted">Unlisted</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreate(false)}
                    disabled={createMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreate}
                    disabled={createMutation.isPending || !createTitle.trim()}
                    className="gap-1.5"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create playlist
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/60 pt-3">
            <Button type="button" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioSectionCard>
  );
}
