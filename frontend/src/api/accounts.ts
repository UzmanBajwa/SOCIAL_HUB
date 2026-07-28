import { api } from "@/lib/api";
import type { ConnectResult, Platform, SocialAccount } from "@/types";

export async function fetchAccounts() {
  const { data } = await api.get<SocialAccount[]>("/accounts");
  return data;
}

export async function getConnectUrl(platform: Platform) {
  const { data } = await api.get<{ authorize_url: string; state: string }>(
    `/accounts/connect/${platform}`
  );
  return data;
}

export async function completeConnect(platform: Platform, code: string, state: string | null) {
  const { data } = await api.post<ConnectResult>("/accounts/connect", { platform, code, state });
  return data;
}

export async function selectPage(platform: Platform, selectionToken: string, pageId: string) {
  const { data } = await api.post<SocialAccount>("/accounts/connect/select", {
    platform,
    selection_token: selectionToken,
    page_id: pageId,
  });
  return data;
}

export async function disconnectAccount(accountId: string) {
  await api.delete(`/accounts/${accountId}`);
}
