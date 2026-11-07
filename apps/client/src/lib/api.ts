import { Platform } from "react-native";
import type { ApiError, Journey } from "@udyam/shared";
import { tokens } from "./storage";

export class RequestError extends Error {
  constructor(
    public details: ApiError,
    public status: number,
  ) {
    super(details.message);
  }
}
export function defaultBase() {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return "http://localhost:3001";
    return window.location.port === "8081"
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.10:3001";
}
export class Api {
  private token: string | null = null;
  private initialization: Promise<Journey> | null = null;
  constructor(public base: string) {}
  async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !form)
      headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetch(`${this.base}/api/v1${path}`, {
        method,
        headers,
        credentials: "include",
        body:
          body === undefined
            ? undefined
            : form
              ? (body as FormData)
              : JSON.stringify(body),
        signal: signal || AbortSignal.timeout(35000),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new RequestError(
        {
          code: "offline",
          message: "Cannot reach the server. Check your connection and retry.",
          messageHi: "सर्वर से संपर्क नहीं हुआ। कनेक्शन जाँचकर फिर कोशिश करें।",
          retryable: true,
        },
        0,
      );
    }
    const data = await response.json();
    if (!response.ok) throw new RequestError(data, response.status);
    return data;
  }
  async restore(): Promise<Journey> {
    if (!this.initialization) {
      this.initialization = (async () => {
        if (Platform.OS !== "web") this.token = await tokens.get(this.base);
        try {
          return await this.request<Journey>("/journey");
        } catch (error) {
          if (!(error instanceof RequestError) || error.status !== 401)
            throw error;
          const session = await this.request<{ token?: string }>(
            "/sessions",
            "POST",
            { platform: Platform.OS === "web" ? "web" : "native" },
          );
          if (session.token) {
            this.token = session.token;
            await tokens.set(this.base, session.token);
          }
          return this.request<Journey>("/journey");
        }
      })();
    }
    try {
      return await this.initialization;
    } finally {
      this.initialization = null;
    }
  }
  async reset() {
    await this.request("/session", "DELETE");
    if (Platform.OS !== "web") await tokens.remove(this.base);
    this.token = null;
  }
}
export const requestId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
