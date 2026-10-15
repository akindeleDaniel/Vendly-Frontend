const apiBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL?.trim()

if (!apiBaseUrl) {
    throw new Error(
        "VITE_API_BASE_URL is not set. Copy .env.example to .env, set the backend URL, and restart the dev server."
    )
}

const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "")

// Calls the Vendly backend. `path` must start with "/" (for example "/cart").
// Request options are passed to fetch unchanged, so each call still decides
// its own method, headers, body, credentials and abort signal.
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${normalizedApiBaseUrl}${path}`, init)
}
