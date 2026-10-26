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

// A 401 from these is never answered with a refresh: login and registration have no session to
// refresh, and refresh is the very call being made.
const refreshExemptPaths = ["/users/login", "/users/register", "/users/refresh"]

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

type RefreshOutcome =
    | "refreshed"// a new pair of cookies is set, so the request can be tried again
    | "rejected"// the refresh cookie is missing, expired or revoked: the person is logged out
    | "unavailable"// the refresh could not run (network or server problem): nothing is known about the session

// Swaps the refresh cookie for a new access cookie. The access cookie only lasts 15 minutes, the
// refresh cookie 30 days. The browser lock makes separate tabs take turns, because the backend
// refuses a refresh token that another tab has only just swapped.
function sendRefreshRequest(): Promise<RefreshOutcome> {
    async function send(): Promise<RefreshOutcome> {
        try {
            const response = await fetch(`${normalizedApiBaseUrl}/users/refresh`, {
                method: "POST",
                credentials: "include"
            })

            if (response.ok) {
                return "refreshed"
            }

            return response.status === 401 ? "rejected" : "unavailable"
        } catch {
            return "unavailable"
        }
    }

    return typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request("vendly-session-refresh", send)
        : send()
}

let refreshInFlight: Promise<RefreshOutcome> | null = null

// Every request that needs a refresh at the same moment waits for the same single refresh.
function refreshSession(): Promise<RefreshOutcome> {
    if (refreshInFlight === null) {
        refreshInFlight = sendRefreshRequest().finally(() => {
            refreshInFlight = null
        })
    }

    return refreshInFlight
}

function reportExpiredSession(path: string) {
    if (!sessionIndependentPaths.some((publicPath) => path.startsWith(publicPath))) {
        unauthorizedHandler?.()
    }
}

// Calls the StoreHatch backend. `path` must start with "/" (for example "/cart").
// Request options are passed to fetch unchanged, so each call still decides
// its own method, headers, body, credentials and abort signal.
//
// When a request that sends the login cookies is answered with 401, the session is refreshed once
// and the request is tried again once. Only if the refresh itself is refused is the person treated
// as logged out.
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${normalizedApiBaseUrl}${path}`
    const response = await fetch(url, init)

    if (
        response.status !== 401 ||
        init?.credentials !== "include" ||
        refreshExemptPaths.some((exemptPath) => path.startsWith(exemptPath))
    ) {
        return response
    }

    const outcome = await refreshSession()

    if (outcome === "refreshed") {
        const retried = await fetch(url, init)

        if (retried.status === 401) {
            reportExpiredSession(path)
        }

        return retried
    }

    if (outcome === "rejected") {
        reportExpiredSession(path)
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
