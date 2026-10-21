// Remembers that the "set a password" pop-up has been dismissed, so it appears once per login
// rather than on every page. It lives in sessionStorage, so it comes back in a new browser session
// and is cleared when someone logs in.

const STORAGE_KEY = "vendly.passwordPromptDismissed"

export function readPasswordPromptDismissed(): boolean {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === "1"
    } catch {
        return false
    }
}

export function markPasswordPromptDismissed() {
    try {
        sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
        // Without storage the pop-up may appear again on a reload, which is harmless.
    }
}

export function clearPasswordPromptDismissed() {
    try {
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        // Nothing to clear if storage is unavailable.
    }
}
