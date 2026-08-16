import axios from "axios";

import { api, API_BASE_URL, tokenStorage } from "@/lib/api";
import type {
  YouTubePlaylist,
  YouTubePlaylistCreate,
  YouTubePlaylistItemResult,
  YouTubePublishRequest,
  YouTubePublishResponse,
  YouTubeUploadInitRequest,
  YouTubeUploadInitResponse,
  YouTubeUploadProgressResponse,
} from "@/types";

export async function initYouTubeUpload(payload: YouTubeUploadInitRequest) {
  const { data } = await api.post<YouTubeUploadInitResponse>("/youtube/upload/init", payload);
  return data;
}

export async function fetchYouTubeUploadProgress(uploadId: string) {
  const { data } = await api.get<YouTubeUploadProgressResponse>(
    `/youtube/upload/${uploadId}/progress`
  );
  return data;
}

export async function cancelYouTubeUpload(uploadId: string) {
  const { data } = await api.post<YouTubeUploadProgressResponse>(
    `/youtube/upload/${uploadId}/cancel`
  );
  return data;
}

export async function setYouTubeThumbnail(uploadId: string, mediaId: string) {
  const { data } = await api.post<YouTubeUploadProgressResponse>(
    `/youtube/upload/${uploadId}/thumbnail`,
    { media_id: mediaId }
  );
  return data;
}

export async function publishYouTubeUpload(
  uploadId: string,
  payload: YouTubePublishRequest = {}
) {
  const { data } = await api.post<YouTubePublishResponse>(
    `/youtube/upload/${uploadId}/publish`,
    payload
  );
  return data;
}

export async function fetchYouTubePlaylists(accountId: string) {
  const { data } = await api.get<YouTubePlaylist[]>("/youtube/playlists", {
    params: { account_id: accountId },
  });
  return data;
}

export async function createYouTubePlaylist(payload: YouTubePlaylistCreate) {
  const { data } = await api.post<YouTubePlaylist>("/youtube/playlists", payload);
  return data;
}

export async function addYouTubeVideoToPlaylist(
  playlistId: string,
  accountId: string,
  videoId: string
) {
  const { data } = await api.post<YouTubePlaylistItemResult>(
    `/youtube/playlists/${playlistId}/videos`,
    { account_id: accountId, video_id: videoId }
  );
  return data;
}

interface XhrUploadErrorBody {
  detail?: string | { msg: string }[];
}

function errorMessage(status: number, body: XhrUploadErrorBody): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return `Upload failed (HTTP ${status}).`;
}

async function refreshAccessTokenOnce(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token available");
  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  tokenStorage.setAccessToken(response.data.access_token as string);
}

/**
 * Stream the video bytes straight from disk to the backend with an XMLHttpRequest so we
 * get real upload progress events. The body is the raw file (never base64, never read
 * fully into memory). A 401 is retried once after refreshing the access token; the
 * backend refuses to restart a session in a conflicting state, so the retry only happens
 * on an auth failure before any bytes were accepted.
 */
export function uploadYouTubeVideo(
  uploadId: string,
  file: File,
  onProgress: (percent: number) => void,
  retried = false,
  signal?: AbortSignal
): Promise<YouTubeUploadProgressResponse> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/youtube/upload/${uploadId}/data`);
    xhr.setRequestHeader("Authorization", `Bearer ${tokenStorage.getAccessToken()}`);
    xhr.responseType = "json";

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = async () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as YouTubeUploadProgressResponse);
        return;
      }
      if (xhr.status === 401 && !retried) {
        try {
          await refreshAccessTokenOnce();
          resolve(await uploadYouTubeVideo(uploadId, file, onProgress, true, signal));
          return;
        } catch {
          // fall through to the original error below
        }
      }
      reject(new Error(errorMessage(xhr.status, (xhr.response ?? {}) as XhrUploadErrorBody)));
    };

    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Network error while uploading the video."));
    };
    xhr.ontimeout = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Upload timed out."));
    };
    xhr.timeout = 0;

    xhr.send(file);
  });
}
