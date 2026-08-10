// Lightweight fetch wrapper for API calls with typed responses and error handling.

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
}

export async function apiFetch<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  })

  if (res.ok) {
    const contentType = res.headers.get("content-type") ?? ""
    const isJson = contentType.includes("application/json")
    return (isJson ? await res.json() : await res.text()) as T
  }

  let message = `Request failed with status ${res.status}`
  let details: unknown
  try {
    const contentType = res.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const body: unknown = await res.json()
      if (body && typeof body === "object" && "error" in body) {
        const err = (body as { error?: unknown }).error
        if (typeof err === "string" && err) message = err
      }
      details = body
    } else {
      details = await res.text()
    }
  } catch {
    // ignore body parse errors — fall back to the status message
  }
  throw new ApiError(message, res.status, details)
}
