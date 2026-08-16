import { api } from "@/lib/api";
import type { Mention, PostLocation } from "@/types";

export async function searchFacebookMentions(accountId: string, q: string) {
  const { data } = await api.get<Mention[]>("/facebook/mentions/search", {
    params: { account_id: accountId, q },
  });
  return data;
}

export async function searchFacebookLocations(accountId: string, q: string) {
  const { data } = await api.get<PostLocation[]>("/facebook/locations/search", {
    params: { account_id: accountId, q },
  });
  return data;
}
