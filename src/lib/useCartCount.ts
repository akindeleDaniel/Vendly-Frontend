import { useEffect, useState } from "react"
import { apiFetch } from "./api"
import type { UserRole } from "../types/user"

// How many things are in a shopper's cart, for the badge on a shop's cart button. `refresh` is anything
// that changes after something is added (a new value checks the cart again).
export function useCartCount(userRole: UserRole | null, refresh?: unknown): number {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (userRole !== "CONSUMER") {
            return
        }
        const controller = new AbortController()

        apiFetch("/cart", { credentials: "include", signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((data: { cart?: { cartItems?: Array<{ quantity: number }> } | null } | null) => {
                if (!controller.signal.aborted) {
                    setCount((data?.cart?.cartItems ?? []).reduce((total, item) => total + item.quantity, 0))
                }
            })
            .catch(() => {
                // The badge simply stays hidden.
            })
        return () => controller.abort()
    }, [userRole, refresh])

    return userRole === "CONSUMER" ? count : 0
}
