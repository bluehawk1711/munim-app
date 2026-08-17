/**
 * Low-level fetch wrapper for the Munim API.
 *
 * Handles base-URL joining, per-platform fetch injection, x-api-key auth,
 * query-string serialization, JSON body encoding, and consistent error
 * mapping (throws `ApiClientError` with the API's `{ error }` message).
 */

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

/** Error thrown for every non-2xx response. Carries the API status + message. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export type HttpOptions = {
  baseUrl: string;
  apiKey: string;
  /** Injectable fetch — desktop passes the Tauri HTTP-plugin fetch, mobile and
   * web pass global fetch. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
};

export type RequestOptions = {
  query?: QueryParams;
  json?: unknown;
  form?: FormData;
  /** When true, returns the raw text body (e.g. CSV reports). */
  text?: boolean;
};

export type HttpClient = {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, query?: QueryParams): Promise<T>;
  getText(path: string, query?: QueryParams): Promise<string>;
  post<T>(path: string, json?: unknown): Promise<T>;
  put<T>(path: string, json?: unknown): Promise<T>;
  patch<T>(path: string, json?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  upload<T>(path: string, form: FormData): Promise<T>;
};

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Parses an error body into a message; falls back to the HTTP status text. */
function errorMessage(status: number, body: string, statusText: string): { message: string; code?: string } {
  try {
    const parsed = JSON.parse(body) as { error?: string; code?: string };
    if (typeof parsed.error === "string" && parsed.error) {
      return { message: parsed.error, code: typeof parsed.code === "string" ? parsed.code : undefined };
    }
  } catch {
    // Non-JSON error body — fall through to statusText.
  }
  return { message: statusText || `Request failed (${status})` };
}

export function createHttpClient(options: HttpOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  async function request<T>(method: string, path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const url = buildUrl(options.baseUrl, path, requestOptions.query);

    const headers: Record<string, string> = {
      "x-api-key": options.apiKey,
    };

    let body: BodyInit | undefined;
    if (requestOptions.form) {
      body = requestOptions.form;
      // Content-Type is set automatically by the fetch implementation
      // (including the multipart boundary) — do NOT set it manually.
    } else if (requestOptions.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(requestOptions.json);
    }

    const response = await fetchImpl(url, { method, headers, body });
    const raw = await response.text();

    if (!response.ok) {
      const { message, code } = errorMessage(response.status, raw, response.statusText);
      throw new ApiClientError(response.status, message, code);
    }

    if (requestOptions.text || response.status === 204) {
      return raw as T;
    }

    if (!raw) return undefined as T;
    return JSON.parse(raw) as T;
  }

  return {
    request,
    get: (path, query) => request("GET", path, { query }),
    getText: (path, query) => request("GET", path, { query, text: true }),
    post: (path, json) => request("POST", path, { json }),
    put: (path, json) => request("PUT", path, { json }),
    patch: (path, json) => request("PATCH", path, { json }),
    del: (path) => request("DELETE", path),
    upload: (path, form) => request("POST", path, { form }),
  };
}
