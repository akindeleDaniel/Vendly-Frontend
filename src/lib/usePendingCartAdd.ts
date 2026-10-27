import { useEffect, useState } from "react"
import { apiFetch, getErrorMessage } from "./api"
import { clearPendingCartItem, readPendingCartItem } from "./pendingCartItem"
import type { UserRole } from "../types/user"

export type PendingCartResult = { text: string, isError: boolean }

// A shopper who was sent to log in or register from a storefront or product page returns there, and
// the product they chose is added to their cart now. Returns what happened, to show on the page.
export function usePendingCartAdd(userRole: UserRole | null): PendingCartResult | null {
    const [result, setResult] = useState<PendingCartResult | null>(null)

    useEffect(() => {
        if (userRole === null) {
            return
        }

        const pending = readPendingCartItem()
        if (!pending) {
            return
        }

        if (userRole === null) {
            clearPendingCartItem()
            return
        }

        if (pending.returnTo.split("?")[0] !== window.location.pathname) {
            return
        }

        clearPendingCartItem()// cleared before the request so the item can never be added twice

        async function addPendingItem() {
            try {
                const response = await apiFetch("/cart/items", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        listingId: pending!.listingId,
                        quantity: pending!.quantity
                    })
                })

                if (!response.ok) {
                    setResult({
                        text: await getErrorMessage(response, "We could not add your chosen item to the cart. Please add it again."),
                        isError: true
                    })
                    return
                }

                setResult({ text: "The item you chose has been added to your cart.", isError: false })
            } catch {
                setResult({
                    text: "We could not add your chosen item to the cart. Please check your connection and add it again.",
                    isError: true
                })
            }
        }

        addPendingItem()
    }, [userRole])

    return result
}
