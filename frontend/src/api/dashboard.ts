import { api } from "@/lib/api";
import type { DashboardResponse } from "@/types";

export async function fetchDashboard() {
  const { data } = await api.get<DashboardResponse>("/dashboard");
  return data;
}
