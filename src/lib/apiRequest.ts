import { apiFetch } from "./api"

// One result type for the calls that need to tell the backend's error codes apart (complaints,
// refunds, administration). Each page decides what a code means; this only reads the response.
export type ApiResult<T> =
    | { kind: "ok", status: number, data: T }
    | { kind: "failed", status: number, code: string | null, message: string, body: unknown, retryAfterSeconds: number | null }
    | { kind: "unauthorized" }
    | { kind: "network-error" }

export const NETWORK_ERROR_MESSAGE = "We could not reach the server. Please check your connection and try again."
// How long to wait before trying again after a 429. The backend sends it in the Retry-After header, but
// a browser only lets a page read that header if the backend lists it in Access-Control-Expose-Headers.
// When it cannot be read, a minute is a sensible wait.
const DEFAULT_RETRY_AFTER_SECONDS = 60

function readRetryAfter(response: Response): number | null {
    if (response.status !== 429) {
        return null
    }

    const seconds = Number(response.headers.get("Retry-After"))
    return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS
}

const UNEXPECTED_RESPONSE_MESSAGE = "We received an unexpected response from the server. Please try again."

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

// The backend sends JSON, except that the authentication middleware can send plain text.
async function readBody(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => "")

    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function messageOf(body: unknown, fallback: string): string {
    if (isRecord(body) && typeof body.message === "string" && body.message) {
        return body.message
    }

    if (typeof body === "string" && body && body.length <= 200 && !body.trim().startsWith("<")) {
        return body
    }

    return fallback
}

type RequestOptions<T> = {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    body?: unknown
    signal?: AbortSignal
    // Checks the shape of a successful body. Without it the body is trusted as T.
    isValid?: (body: unknown) => body is T
    fallbackMessage?: string
}

export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<ApiResult<T>> {
    const { method = "GET", body, signal, isValid, fallbackMessage } = options
    let response: Response

    try {
        response = await apiFetch(path, {
            method,
            credentials: "include",
            signal,
            ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
        })
    } catch {
        return { kind: "network-error" }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    const data = await readBody(response)

    if (response.ok) {
        if (isValid && !isValid(data)) {
            return { kind: "failed", status: response.status, code: null, message: UNEXPECTED_RESPONSE_MESSAGE, body: data, retryAfterSeconds: null }
        }

        return { kind: "ok", status: response.status, data: data as T }
    }

    return {
        kind: "failed",
        status: response.status,
        code: isRecord(data) && typeof data.code === "string" ? data.code : null,
        message: messageOf(data, fallbackMessage ?? `Something went wrong (status ${response.status}).`),
        body: data,
        retryAfterSeconds: readRetryAfter(response)
    }
}

// A short message for the results that are not "ok", for pages that do not treat any code specially.
export function failureMessage(result: Exclude<ApiResult<unknown>, { kind: "ok" }>): string {
    if (result.kind === "network-error") {
        return NETWORK_ERROR_MESSAGE
    }

    if (result.kind === "unauthorized") {
        return "Your session has ended. Please log in again."
    }

    return result.message
}
