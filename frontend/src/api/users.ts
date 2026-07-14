/** api/users.ts — admin-only account creation. */
import { api } from "@/lib/apiClient";
import type { AuthUser } from "@/types";

export interface UserCreatePayload {
  email: string;
  full_name: string;
  role: string;
  password: string;
}

export async function fetchUsers(): Promise<AuthUser[]> {
  const { data } = await api.get<AuthUser[]>("/users");
  return data;
}

export async function createUser(payload: UserCreatePayload): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>("/users", payload);
  return data;
}
