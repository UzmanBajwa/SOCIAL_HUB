export type Platform = "facebook" | "instagram" | "linkedin" | "youtube";

export type AccountStatus = "active" | "expired" | "revoked" | "error";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed";

export type PostPlatformStatus = "pending" | "publishing" | "processing" | "published" | "failed";

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  account_name: string;
  account_username: string | null;
  avatar_url: string | null;
  status: AccountStatus;
  scopes: string[] | null;
  extra_data: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
}

export interface PageCandidate {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  category: string | null;
}

export interface PageSelectionResponse {
  platform: Platform;
  pages: PageCandidate[];
}

export interface ConnectResult {
  requires_selection: boolean;
  selection: PageSelectionResponse | null;
  selection_token: string | null;
  account: SocialAccount | null;
}

export interface PostPlatformRecord {
  id: string;
  platform: Platform;
  social_account_id: string;
  status: PostPlatformStatus;
  platform_post_id: string | null;
  published_at: string | null;
  error_message: string | null;
  retry_count: number;
  meta: Record<string, unknown> | null;
}

export interface MediaItem {
  url: string;
  type: "image" | "video";
}

export interface Mention {
  id: string;
  name: string;
}

export interface PostLocation {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  media_items: MediaItem[] | null;
  thumbnail_url: string | null;
  share_to_feed: boolean;
  is_pinned: boolean;
  publish_as_reel: boolean;
  mentions: Mention[] | null;
  location: PostLocation | null;
  timezone: string | null;
  platform_options: Record<string, unknown> | null;
  status: PostStatus;
  publish_date: string | null;
  created_at: string;
  platforms: PostPlatformRecord[];
}

export interface DashboardResponse {
  connected_accounts: SocialAccount[];
  upcoming_scheduled_posts: Post[];
  recent_posts: Post[];
  total_posts_published: number;
  total_accounts_connected: number;
}

export interface Media {
  id: string;
  file_name: string;
  file_url: string;
  type: "image" | "video";
  size: number;
  created_at: string;
}

export type YouTubeUploadStatus =
  | "initialized"
  | "uploading"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type YouTubePrivacy = "public" | "private" | "unlisted";

export interface YouTubeUploadInitRequest {
  account_id: string;
  total_size: number;
  title: string;
  description?: string | null;
  privacy_status: YouTubePrivacy;
  tags?: string[];
  category?: string | null;
  made_for_kids?: boolean;
  thumbnail_url?: string | null;
}

export interface YouTubeUploadInitResponse {
  upload_id: string;
  status: YouTubeUploadStatus;
  progress: number;
  title: string;
  total_size: number;
  video_id: string | null;
  error: string | null;
  post_id: string | null;
}

export interface YouTubeUploadProgressResponse {
  upload_id: string;
  status: YouTubeUploadStatus;
  progress: number;
  video_id: string | null;
  error: string | null;
  post_id: string | null;
}

export interface YouTubePublishRequest {
  publish_date?: string | null;
  timezone?: string | null;
  playlist_ids?: string[];
}

export interface YouTubePlaylist {
  playlist_id: string;
  title: string;
  description: string | null;
  privacy_status: string | null;
  item_count: number | null;
  thumbnail_url: string | null;
}

export interface YouTubePlaylistCreate {
  account_id: string;
  title: string;
  description?: string | null;
  privacy_status: YouTubePrivacy;
}

export interface YouTubePlaylistItemResult {
  playlist_id: string;
  success: boolean;
  error: string | null;
}

export interface YouTubePublishResponse {
  post: Post;
  playlist_results: YouTubePlaylistItemResult[];
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

// YouTube's service/types/routes are kept intact on the backend; enable it in the UI here
// and in backend ENABLED_PLATFORMS. YouTube uses its own Studio-style uploader (separate
// from the social Composer), but the connected account still appears on the Accounts page.
export const SUPPORTED_PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "youtube"];
