import { useState } from "react"
import { formatOrderDay } from "./buyerOrders"
import type { ProgressStep, StatusTone } from "./buyerOrders"
import { markOrderShipped, reportOrderDelivered } from "./orderApi"
import type { ActionOutcome } from "./orderApi"
import type { Fulfilment, SellerOrder } from "../types/order"

// What the seller's order pages (the list and one order) share: the status in the seller's words,
// the order's progress, and the two actions, marking it shipped and marking it delivered.

type SellerOrderState = { status: string, paidAt: string | null, createdAt: string } & Fulfilment

export type FulfilmentUpdate = { status: string } & Fulfilment

export function describeSellerStatus(order: SellerOrderState): { label: string, tone: StatusTone } {
    switch (order.status) {
        case "PAID":
            return { label: "To ship", tone: "attention" }
        case "SHIPPED":
            return order.deliveryReportedAt ? { label: "Waiting for buyer", tone: "progress" } : { label: "On the way", tone: "progress" }
        case "DELIVERED":
            return { label: "Delivered", tone: "done" }
        case "REFUNDED":
            return { label: "Refunded", tone: "neutral" }
        default:
            return { label: order.status, tone: "neutral" }
    }
}

export function canShip(order: { status: string }): boolean {
    return order.status === "PAID"
}

// A seller can report delivery straight from "paid" too, for an order they took over by hand.
export function canReportDelivered(order: { status: string } & Pick<Fulfilment, "deliveryReportedAt">): boolean {
    return (order.status === "PAID" || order.status === "SHIPPED") && order.deliveryReportedAt === null
}

// Paid, shipped, marked delivered by the seller, and confirmed by the buyer (or closed after 7 days).
export function sellerProgressSteps(order: SellerOrderState): ProgressStep[] {
    const day = (isoTime: string | null | undefined) => formatOrderDay(isoTime, { time: true })
    const isDelivered = order.status === "DELIVERED"
    const isRefunded = order.status === "REFUNDED"
    const shipped = order.shippedAt !== null
    const reported = order.deliveryReportedAt !== null

    return [
        { label: "Paid", detail: day(order.paidAt ?? order.createdAt), state: "done" },
        shipped
            ? { label: "Shipped", detail: day(order.shippedAt), state: "done" }
            : { label: "Shipped", detail: order.status === "PAID" ? "Your next step" : "—", state: order.status === "PAID" ? "waiting" : isRefunded ? "stopped" : "next" },
        reported || isDelivered
            ? { label: "You marked delivered", detail: day(order.deliveryReportedAt) || "—", state: "done" }
            : { label: "You marked delivered", detail: "Not yet", state: order.status === "SHIPPED" ? "waiting" : "next" },
        isDelivered
            ? { label: "Buyer confirmed", detail: order.deliveryConfirmedAt ? day(order.deliveryConfirmedAt) : order.deliveryAutoClosedAt ? `Closed ${day(order.deliveryAutoClosedAt)}` : "—", state: "done" }
            : { label: "Buyer confirmed", detail: reported ? "Waiting" : "Not yet", state: reported ? "waiting" : "next" }
    ]
}

// Marks one order shipped (with an optional note for the buyer) or delivered, and passes on the
// order's new status and dates. Each order has its own, so orders in a list update separately.
export function useFulfilmentAction(orderId: number, onUpdated: (update: FulfilmentUpdate) => void) {
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")

    async function run(action: () => Promise<ActionOutcome<SellerOrder>>): Promise<boolean> {
        setIsWorking(true)
        setError("")
        const result = await action()
        setIsWorking(false)

        if (result.kind === "ok") {
            const { status, shippedAt, shippingNote, deliveryReportedAt, deliveryConfirmedAt, deliveryAutoClosedAt } = result.data
            onUpdated({ status, shippedAt, shippingNote, deliveryReportedAt, deliveryConfirmedAt, deliveryAutoClosedAt })
            return true
        }

        setError(result.kind === "not-found" ? "We could not find this order." : result.kind === "unauthorized" ? "Your session has ended. Please log in again." : result.message)
        return false
    }

    return {
        isWorking,
        error,
        ship: (note: string) => run(() => markOrderShipped(orderId, note)),
        reportDelivered: () => run(() => reportOrderDelivered(orderId))
    }
}
