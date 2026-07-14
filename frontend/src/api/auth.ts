/** api/auth.ts — login + current user. */
import { api } from "@/lib/apiClient";
import type { AuthUser, Role } from "@/types";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  full_name: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
}
