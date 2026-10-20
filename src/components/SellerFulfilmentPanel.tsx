import { useState } from "react"
import FulfilmentTimeline from "./FulfilmentTimeline"
import Notice from "./Notice"
import { markOrderShipped, reportOrderDelivered } from "../lib/orderApi"
import type { ActionOutcome } from "../lib/orderApi"
import type { Fulfilment, SellerOrder } from "../types/order"

export type FulfilmentUpdate = { status: string } & Fulfilment

type SellerFulfilmentPanelProps = {
    order: { id: number, status: string, paidAt: string | null } & Fulfilment
    // Called with the order's new status and dates after the seller marks it shipped or delivered.
    onUpdated: (update: FulfilmentUpdate) => void
}

// One order's fulfilment for the seller: where it has got to, and the buttons for the next step.
// Each order shows its own panel with its own state, because orders in the same list can be at
// different stages. The seller's "delivered" report is not final: the buyer is asked to confirm it.
function SellerFulfilmentPanel({ order, onUpdated }: SellerFulfilmentPanelProps) {
    const [shippingNote, setShippingNote] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)
    const [updateError, setUpdateError] = useState("")

    const canShip = order.status === "PAID"
    const canReportDelivered = (order.status === "PAID" || order.status === "SHIPPED") && order.deliveryReportedAt === null

    // Runs one fulfilment action and passes on the updated order, or says why it did not work.
    async function update(action: () => Promise<ActionOutcome<SellerOrder>>) {
        setIsUpdating(true)
        setUpdateError("")
        const result = await action()
        setIsUpdating(false)

        if (result.kind === "ok") {
            const { status, shippedAt, shippingNote: note, deliveryReportedAt, deliveryConfirmedAt } = result.data
            onUpdated({ status, shippedAt, shippingNote: note, deliveryReportedAt, deliveryConfirmedAt })
        } else if (result.kind === "refused" || result.kind === "error") {
            setUpdateError(result.message)
        } else if (result.kind === "not-found") {
            setUpdateError("We could not find this order.")
        }
    }

    return (
        <div className="fulfilment-panel">
            <FulfilmentTimeline status={order.status} paidAt={order.paidAt} fulfilment={order} viewer="seller" />

            {(canShip || canReportDelivered) && (
                <div className="fulfilment-actions">
                    {canShip && (
                        <div className="fulfilment-note-field">
                            <label htmlFor={`shipping-note-${order.id}`}>Note for the buyer (optional)</label>
                            <input
                                id={`shipping-note-${order.id}`}
                                type="text"
                                maxLength={200}
                                value={shippingNote}
                                onChange={(event) => setShippingNote(event.target.value)}
                                placeholder="Courier and tracking number"
                                disabled={isUpdating}
                            />
                        </div>
                    )}
                    {updateError && <Notice kind="error">{updateError}</Notice>}
                    <div className="fulfilment-buttons">
                        {canShip && (
                            <button type="button" className="btn btn-primary" disabled={isUpdating} onClick={() => update(() => markOrderShipped(order.id, shippingNote))}>
                                {isUpdating ? "Saving..." : "Mark as shipped"}
                            </button>
                        )}
                        {canReportDelivered && (
                            <button type="button" className="btn" disabled={isUpdating} onClick={() => update(() => reportOrderDelivered(order.id))}>
                                Mark as delivered
                            </button>
                        )}
                    </div>
                    <p className="fulfilment-hint">
                        Marking an order delivered asks the buyer to confirm they received it. The order is only completed once they do.
                    </p>
                </div>
            )}
            {order.status === "SHIPPED" && order.deliveryReportedAt !== null && (
                <Notice kind="info">You reported this order as delivered. We have asked the buyer to confirm they received it.</Notice>
            )}
        </div>
    )
}

export default SellerFulfilmentPanel
