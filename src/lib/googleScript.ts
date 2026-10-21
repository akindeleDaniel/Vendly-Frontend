const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client"

let loading: Promise<void> | null = null

// Loads Google's sign-in script once for the whole app. If it cannot load (offline, or blocked by
// the browser), the promise is dropped so the next call tries again.
export function loadGoogleScript(): Promise<void> {
    if (window.google?.accounts?.id) {
        return Promise.resolve()
    }

    if (loading === null) {
        loading = new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src = GOOGLE_SCRIPT_URL
            script.async = true
            script.defer = true
            script.onload = () => resolve()
            script.onerror = () => {
                script.remove()
                loading = null
                reject(new Error("Google sign-in could not be loaded"))
            }
            document.head.appendChild(script)
        })
    }

    return loading
}

// The Google client id for this site. Without it the Google button is simply not shown.
export function getGoogleClientId(): string | null {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
    return clientId ? clientId : null
}
