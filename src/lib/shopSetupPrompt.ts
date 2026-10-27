// Whether the "Set up your shop" pop-up was closed with "Later". It stays closed for the rest of the
// visit and comes back after the next login, like the set-password pop-up.
const KEY = "storehatch.shopSetupPromptDismissed"

export function readShopSetupPromptDismissed(): boolean {
    try {
        return window.sessionStorage.getItem(KEY) === "1"
    } catch {
        return false
    }
}

export function markShopSetupPromptDismissed(): void {
    try {
        window.sessionStorage.setItem(KEY, "1")
    } catch {
        // Private browsing or blocked storage: the pop-up simply closes for now.
    }
}

export function clearShopSetupPromptDismissed(): void {
    try {
        window.sessionStorage.removeItem(KEY)
    } catch {
        // Nothing to clear.
    }
}
