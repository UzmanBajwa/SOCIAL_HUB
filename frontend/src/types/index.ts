export type Platform = "facebook" | "instagram" | "linkedin" | "youtube";

export type AccountStatus = "active" | "expired" | "revoked" | "error";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed";

export type PostPlatformStatus = "pending" | "publishing" | "published" | "failed";

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
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  thumbnail_url: string | null;
  share_to_feed: boolean;
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

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

// This MVP only supports connecting Facebook and Instagram. LinkedIn/YouTube services,
// types, and routes are kept intact on the backend for a future release -- re-enabling
// them here (and in backend ENABLED_PLATFORMS) is a one-line change, not a rewrite.
export const SUPPORTED_PLATFORMS: Platform[] = ["facebook", "instagram"];
