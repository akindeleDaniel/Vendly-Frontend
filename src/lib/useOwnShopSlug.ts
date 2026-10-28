import { useEffect, useState } from "react"
import { apiFetch } from "./api"
import type { UserRole } from "../types/user"

// The signed-in seller's own shop link name (slug), so a product or shop page can tell it is their own and leave
// out Add to cart: the backend refuses buying from your own shop. Null for anyone without a shop, and while it is
// being checked. A failed check also gives null; the backend's refusal is then the safety net.
export function useOwnShopSlug(userRole: UserRole | null): string | null {
    const [found, setFound] = useState<{ role: UserRole, slug: string } | null>(null)
    const isSeller = userRole === "SELLER"

    useEffect(() => {
        if (!isSeller) {
            return
        }
        const controller = new AbortController()

        apiFetch("/seller/profile", { credentials: "include", signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((data: unknown) => {
                if (!controller.signal.aborted && typeof data === "object" && data !== null && "slug" in data && typeof data.slug === "string") {
                    setFound({ role: "SELLER", slug: data.slug })
                }
            })
            .catch(() => {
                // Unknown: the buttons stay, and the backend refuses with a clear message.
            })
        return () => controller.abort()
    }, [isSeller])

    return isSeller && found ? found.slug : null
}
