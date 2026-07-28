import { api } from "@/lib/api";
import type { AuthResponse, User } from "@/types";

export async function registerUser(name: string, email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/register", { name, email, password });
  return data;
}

export async function loginUser(email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await api.get<User>("/me");
  return data;
}

export async function requestPasswordReset(email: string) {
  const { data } = await api.post<{ message: string }>("/auth/password-reset/request", { email });
  return data;
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  await api.post("/auth/password-reset/confirm", { token, new_password: newPassword });
}

export async function logoutUser() {
  await api.post("/auth/logout");
}
