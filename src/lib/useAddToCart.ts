import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { apiFetch } from "./api"
import { savePendingCartItem } from "./pendingCartItem"
import type { UserRole } from "../types/user"

export type CartFeedback = {
    text: string
    kind: "success" | "error" | "info"
}

// How long the message under Add to cart stays before it goes away. Errors stay longer because
// they take longer to read.
const FEEDBACK_DURATION_MS: Record<CartFeedback["kind"], number> = {
    success: 3000,
    info: 5000,
    error: 8000
}

// Adding one product to the cart, shared by the product cards and the product page: the chosen
// quantity, the request, and the message that follows it. A visitor who is not logged in is sent to
// log in or register; the chosen product is remembered, and the page they came from adds it once
// they are back.
export function useAddToCart(
    listing: { id: number, stockQuantity: number } | null,
    userRole: UserRole | null | undefined,
    isLoggedOut: boolean | undefined
) {
    const navigate = useNavigate()
    const location = useLocation()
    const [isAdding, setIsAdding] = useState(false)
    const [feedback, setFeedback] = useState<CartFeedback | null>(null)
    const [chosenQuantity, setChosenQuantity] = useState(1)
    const quantity = listing ? Math.min(chosenQuantity, listing.stockQuantity) : chosenQuantity

    // The message clears itself. Each new message is a new object, so repeating the same one
    // (adding twice) restarts the timer.
    useEffect(() => {
        if (feedback === null) {
            return
        }

        const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS[feedback.kind])
        return () => window.clearTimeout(timer)
    }, [feedback])

    // Choosing another quantity clears a message about the old one.
    function setQuantity(value: number) {
        setChosenQuantity(value)
        setFeedback(null)
    }

    async function addToCart() {
        if (!listing || listing.stockQuantity === 0) {
            return
        }

        if (isLoggedOut) {
            savePendingCartItem({
                listingId: listing.id,
                quantity,
                returnTo: `${location.pathname}${location.search}`
            })
            navigate("/login")
            return
        }

        // The session is still being checked (or the check failed), so the visitor may well be logged in.
        if (userRole === null || userRole === undefined) {
            setFeedback({ text: "We are still checking your session. Please try again in a moment.", kind: "info" })
            return
        }

        setIsAdding(true)
        setFeedback(null)

        try {
            const response = await apiFetch("/cart/items", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    listingId: listing.id,
                    quantity
                })
            })

            if (response.status === 401) {
                navigate("/login")
                return
            }

            if (!response.ok) {
                const data: unknown = await response.json().catch(() => null)
                const message =
                    typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
                        ? data.message
                        : response.status === 409
                            ? "This listing is sold out or does not have enough stock."
                            : `Unable to add this listing to your cart (status ${response.status}).`
                setFeedback({ text: message, kind: "error" })
                return
            }

            setFeedback({ text: "Added to cart.", kind: "success" })
        } catch {
            setFeedback({
                text: "Unable to add this listing to your cart. Please check your connection and try again.",
                kind: "error"
            })
        } finally {
            setIsAdding(false)
        }
    }

    return { quantity, setQuantity, isAdding, feedback, addToCart }
}
