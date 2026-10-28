import { useState } from "react"
import { Link } from "react-router-dom"
import { confirmOrderReceived } from "../lib/orderApi"
import type { CustomerOrder } from "../types/order"
import { LAGOS_TIME_ZONE } from "../lib/lagosTime"

// How long after the seller reports delivery the order is closed as delivered without an answer
// (deliveryAutoCloseAfterDays in the backend).
const AUTO_CLOSE_DAYS = 7

type ConfirmReceiptPromptProps = {
    checkoutId: number
    sellerOrderId: number
    shopName?: string
    reportedAt?: string | null// when the seller said it was delivered
    // Shows "Report a problem", for an order without a complaint.
    canReport?: boolean
    // Called with the updated order once the buyer's confirmation is saved.
    onConfirmed: (order: CustomerOrder) => void
}

function formatDay(date: Date): string {
    return date.toLocaleDateString("en-NG", { timeZone: LAGOS_TIME_ZONE, day: "numeric", month: "short" })
}

// Asks the buyer whether one seller's order arrived, after the seller has said it was delivered.
// The buyer's confirmation is what completes the order. Each seller order has its own prompt, so
// the orders in a list can be confirmed independently.
function ConfirmReceiptPrompt({ checkoutId, sellerOrderId, shopName, reportedAt, canReport, onConfirmed }: ConfirmReceiptPromptProps) {
    const [isConfirming, setIsConfirming] = useState(false)
    const [error, setError] = useState("")
    const reported = reportedAt ? new Date(reportedAt) : null
    const hasDate = reported !== null && !Number.isNaN(reported.getTime())

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
        <div className="confirm-receipt">
            <p className="confirm-receipt-text">
                <strong>Did you get this order?</strong>
                <span>
                    {shopName ?? "The seller"} says it was delivered{hasDate ? ` on ${formatDay(reported)}` : ""}. Only confirm once you have it.
                    {hasDate && ` If you don't answer, it is marked delivered after ${formatDay(new Date(reported.getTime() + AUTO_CLOSE_DAYS * 86_400_000))}.`}
                </span>
            </p>
            {error && <p className="confirm-receipt-error" role="alert">{error}</p>}
            <div className="confirm-receipt-actions">
                <button type="button" className="btn btn-primary" disabled={isConfirming} onClick={confirm}>
                    {isConfirming ? "Confirming..." : "Yes, I got it"}
                </button>
                {canReport && (
                    <Link to={`/orders/${checkoutId}/seller-orders/${sellerOrderId}/complaint`} className="btn">Report a problem</Link>
                )}
            </div>
        </div>
    )
}

export default ConfirmReceiptPrompt
