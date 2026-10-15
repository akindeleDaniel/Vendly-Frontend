const apiBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL?.trim()

if (!apiBaseUrl) {
    throw new Error(
        "VITE_API_BASE_URL is not set. Copy .env.example to .env, set the backend URL, and restart the dev server."
    )
}

const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "")

// These endpoints answer 401 for ordinary reasons (wrong password, "not logged in" check),
// so a 401 from them must not be treated as an expired session.
const sessionIndependentPaths = ["/users/login", "/users/register", "/users/check"]

let unauthorizedHandler: (() => void) | null = null

// Registers a callback that runs when an authenticated request is rejected with 401
// (missing, invalid or expired session). Returns a function that removes the callback.
export function setUnauthorizedHandler(handler: () => void): () => void {
    unauthorizedHandler = handler
    return () => {
        if (unauthorizedHandler === handler) {
            unauthorizedHandler = null
        }
    }
}

// Calls the Vendly backend. `path` must start with "/" (for example "/cart").
// Request options are passed to fetch unchanged, so each call still decides
// its own method, headers, body, credentials and abort signal.
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${normalizedApiBaseUrl}${path}`, init)

    if (
        response.status === 401 &&
        init?.credentials === "include" &&
        !sessionIndependentPaths.some((publicPath) => path.startsWith(publicPath))
    ) {
        unauthorizedHandler?.()
    }

    return response
}

// Reads a user-facing message from a failed response. The backend sends either
// {"message": "..."} or a plain text body, so both are handled; anything else uses the fallback.
export async function getErrorMessage(response: Response, fallback: string): Promise<string> {
    const text = await response.text().catch(() => "")

    try {
        const data: unknown = JSON.parse(text)
        if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string" && data.message) {
            return data.message
        }
    } catch {
        if (text && text.length <= 200 && !text.trim().startsWith("<")) {
            return text
        }
    }

    return fallback
}
