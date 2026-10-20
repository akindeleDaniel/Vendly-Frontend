import { useState } from "react"
import Notice from "./Notice"
import { confirmOrderReceived } from "../lib/orderApi"
import type { CustomerOrder } from "../types/order"

type ConfirmReceiptPromptProps = {
    checkoutId: number
    sellerOrderId: number
    // Called with the updated order once the buyer's confirmation is saved.
    onConfirmed: (order: CustomerOrder) => void
}

// Asks the buyer whether one seller's order arrived, after the seller has said it was delivered.
// The buyer's confirmation is what completes the order. Each seller order has its own prompt, so
// the orders in a list can be confirmed independently.
function ConfirmReceiptPrompt({ checkoutId, sellerOrderId, onConfirmed }: ConfirmReceiptPromptProps) {
    const [isConfirming, setIsConfirming] = useState(false)
    const [error, setError] = useState("")

    async function confirm() {
        setIsConfirming(true)
        setError("")
        const result = await confirmOrderReceived(checkoutId, sellerOrderId)
        setIsConfirming(false)

        if (result.kind === "ok") {
            onConfirmed(result.data)
        } else if (result.kind === "refused" || result.kind === "error") {
            setError(result.message)
        } else if (result.kind === "not-found") {
            setError("We could not find this order.")
        }
    }

    return (
        <Notice kind="warning">
            <p><strong>Your order has been delivered.</strong> The seller says it has arrived. Did you receive it?</p>
            <p>Only confirm once you have it. Confirming completes the order.</p>
            {error && <p>{error}</p>}
            <button type="button" className="btn btn-primary" disabled={isConfirming} onClick={confirm}>
                {isConfirming ? "Confirming..." : "Yes, I received it"}
            </button>
        </Notice>
    )
}

export default ConfirmReceiptPrompt
