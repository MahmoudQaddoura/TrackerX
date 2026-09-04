/**
 * lib/auth.ts
 * Compatibility stubs retained for older imports during rolling upgrades.
 * Authentication now uses an HttpOnly same-site cookie managed by the API.
 */
const TOKEN_KEY = "ptt_token";

export function getToken(): string | null {
  return null;
}

export function setToken(_token: string): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
