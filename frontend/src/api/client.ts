const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type ApiError = {
  error: string;
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");

  const fallbackToken = typeof window !== "undefined" ? localStorage.getItem("invexa-token") : null;
  const effectiveToken = token ?? fallbackToken;

  if (effectiveToken) {
    headers.set("Authorization", `Bearer ${effectiveToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as ApiError;
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // Non-JSON response, keep fallback message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}
