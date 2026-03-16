import type { ApiError } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  path: string;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: HeadersInit;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(base + normalizedPath, window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function createApiError(response: Response, payload: unknown): ApiError {
  const messageFromBody =
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message: unknown }).message === "string"
      ? (payload as { message: string }).message
      : undefined;

  const errorMessage = messageFromBody ?? `Request failed with status ${response.status}`;

  const error = new Error(errorMessage) as ApiError;
  error.statusCode = response.status;
  error.details = payload;
  return error;
}

export async function request<TResponse>(options: RequestOptions): Promise<TResponse> {
  const { path, method = "GET", query, body, headers } = options;

  const url = buildUrl(path, query);

  const init: RequestInit = {
    method,
    headers: {
      "Accept": "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  };

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (fetchError) {
    const networkError = new Error("Network request failed") as ApiError;
    networkError.details = fetchError;
    throw networkError;
  }

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    throw createApiError(response, payload);
  }

  return payload as TResponse;
}

export function getJson<TResponse>(
  path: string,
  query?: RequestOptions["query"],
  headers?: HeadersInit,
): Promise<TResponse> {
  return request<TResponse>({ path, method: "GET", query, headers });
}

export function postJson<TBody, TResponse>(
  path: string,
  body: TBody,
  headers?: HeadersInit,
): Promise<TResponse> {
  return request<TResponse>({ path, method: "POST", body, headers });
}

export function putJson<TBody, TResponse>(
  path: string,
  body: TBody,
  headers?: HeadersInit,
): Promise<TResponse> {
  return request<TResponse>({ path, method: "PUT", body, headers });
}

