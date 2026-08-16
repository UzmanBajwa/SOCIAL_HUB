import type { YouTubePrivacy } from "@/types";

export const MAX_VIDEO_BYTES = 4096 * 1024 * 1024; // 4GB, matches backend youtube_max_video_mb
export const MAX_VIDEO_MB = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));

export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

export function isValidVideoFile(file: File): { ok: boolean; reason?: string } {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, reason: `Video exceeds the ${MAX_VIDEO_MB}MB limit.` };
  }
  if (
    !ALLOWED_VIDEO_EXTENSIONS.includes(extension) &&
    !ALLOWED_VIDEO_MIME_TYPES.includes(file.type)
  ) {
    return { ok: false, reason: "Supported formats: MP4, MOV or WebM." };
  }
  return { ok: true };
}

export const PRIVACY_OPTIONS: { value: YouTubePrivacy; label: string; hint: string }[] = [
  { value: "public", label: "Public", hint: "Anyone can search for and view this video." },
  { value: "unlisted", label: "Unlisted", hint: "Anyone with the link can view it." },
  { value: "private", label: "Private", hint: "Only you and people you share it with." },
];

export const YOUTUBE_CATEGORIES: { id: string; label: string }[] = [
  { id: "1", label: "Film & Animation" },
  { id: "2", label: "Autos & Vehicles" },
  { id: "10", label: "Music" },
  { id: "15", label: "Pets & Animals" },
  { id: "17", label: "Sports" },
  { id: "19", label: "Travel & Events" },
  { id: "20", label: "Gaming" },
  { id: "21", label: "Videoblogging" },
  { id: "22", label: "People & Blogs" },
  { id: "23", label: "Comedy" },
  { id: "24", label: "Entertainment" },
  { id: "25", label: "News & Politics" },
  { id: "26", label: "Howto & Style" },
  { id: "27", label: "Education" },
  { id: "28", label: "Science & Technology" },
  { id: "29", label: "Nonprofits & Activism" },
  { id: "42", label: "Shows" },
];

export const VISIBILITY_LABEL: Record<YouTubePrivacy, string> = {
  public: "Public",
  private: "Private",
  unlisted: "Unlisted",
};
