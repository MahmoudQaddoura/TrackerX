/**
 * lib/auth.ts
 * Token persistence in localStorage. One purpose: read/write/clear the JWT.
 */
const TOKEN_KEY = "ptt_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
