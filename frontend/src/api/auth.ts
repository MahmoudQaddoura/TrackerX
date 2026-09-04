/** api/auth.ts — login + current user. */
import { api } from "@/lib/apiClient";
import type { AccessLevel, AuthUser, Role } from "@/types";

export interface LoginResponse {
  access_token: string | null;
  token_type: string;
  role: Role;
  full_name: string;
  access_level: AccessLevel;
  must_change_password: boolean;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthUser> {
  const { data } = await api.put<AuthUser>("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}
