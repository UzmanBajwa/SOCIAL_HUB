import { api } from "@/lib/api";
import type { Media } from "@/types";

export async function uploadMedia(file: File, onProgress?: (percent: number) => void) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<Media>("/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return data;
}
