import { api } from "@/lib/api";
import type { Post } from "@/types";

export interface CreatePostPayload {
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  thumbnail_url?: string | null;
  share_to_feed?: boolean;
  platform_account_ids: string[];
  publish_date?: string | null;
}

export async function fetchPosts() {
  const { data } = await api.get<Post[]>("/posts");
  return data;
}

export async function fetchPost(id: string) {
  const { data } = await api.get<Post>(`/posts/${id}`);
  return data;
}

export async function createPost(payload: CreatePostPayload) {
  const { data } = await api.post<Post>("/posts", payload);
  return data;
}

export async function updatePost(id: string, payload: Partial<CreatePostPayload>) {
  const { data } = await api.put<Post>(`/posts/${id}`, payload);
  return data;
}

export async function deletePost(id: string) {
  await api.delete(`/posts/${id}`);
}

export async function publishPost(id: string) {
  const { data } = await api.post<Post>(`/posts/${id}/publish`);
  return data;
}

export async function schedulePost(id: string, publishDate: string) {
  const { data } = await api.post<Post>(`/posts/${id}/schedule`, { publish_date: publishDate });
  return data;
}
