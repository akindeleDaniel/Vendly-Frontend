// Remembers the product a logged-out shopper tried to add to the cart, so the storefront can add it
// after they log in or register. It lives in sessionStorage, so it survives the trip through the
// login and registration pages but disappears when the tab is closed.

export type PendingCartItem = {
    listingId: number
    quantity: number
    returnTo: string // storefront path (with its query string) to come back to
    createdAt: number
}

const STORAGE_KEY = "vendly.pendingCartItem"
const MAX_AGE_MS = 30 * 60 * 1000

// Only an in-app path is trusted as a return address.
function isSafeInAppPath(path: unknown): path is string {
    return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
}

export function savePendingCartItem(item: Omit<PendingCartItem, "createdAt">) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...item, createdAt: Date.now() }))
    } catch {
        // Without storage the shopper simply adds the item again after logging in.
    }
}

export function readPendingCartItem(): PendingCartItem | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return null
        }

        const value: unknown = JSON.parse(raw)
        if (
            typeof value === "object" && value !== null &&
            "listingId" in value && Number.isInteger(value.listingId) &&
            "quantity" in value && Number.isInteger(value.quantity) &&
            "returnTo" in value && isSafeInAppPath(value.returnTo) &&
            "createdAt" in value && typeof value.createdAt === "number" &&
            Date.now() - value.createdAt < MAX_AGE_MS
        ) {
            return {
                listingId: value.listingId as number,
                quantity: value.quantity as number,
                returnTo: value.returnTo,
                createdAt: value.createdAt
            }
        }
    } catch {
        // Unreadable data is treated as no pending item.
    }

    // Reading never changes storage, so it is safe to call while rendering. Expired or invalid
    // data is ignored here and replaced the next time an item is saved.
    return null
}

export function clearPendingCartItem() {
    try {
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        // Nothing to clear if storage is unavailable.
    }
}
