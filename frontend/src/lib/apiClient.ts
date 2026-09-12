/**
 * lib/apiClient.ts
 * The single axios instance. Attaches the bearer token on every request and,
 * on a 401, clears the token and bounces to /login. One purpose: HTTP transport.
 */
import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "X-TrackerX-Request": "1" },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !location.pathname.startsWith("/login")) {
      location.assign("/login");
    }
    return Promise.reject(error);
  },
);

/** Normalise a FastAPI error (string detail or validation array) into text. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") {
      return detail.message;
    }
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    if (error.message) return error.message;
  }
  return fallback;
}
