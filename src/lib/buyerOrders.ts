import { formatOrderStatus } from "./orderApi"
import type { Fulfilment } from "../types/order"

// What the shopper's order pages (My orders and an order's own page) show about one shop's part of an order.

type ShopOrderState = { status: string } & Fulfilment

// "25 Oct", with the year and the time when asked: "25 Oct 2026, 2:14 pm".
export function formatOrderDay(isoTime: string | null | undefined, options: { year?: boolean, time?: boolean } = {}): string {
    const date = isoTime ? new Date(isoTime) : null

    if (!date || Number.isNaN(date.getTime())) {
        return ""
    }

    const day = date.toLocaleDateString("en-NG", { day: "numeric", month: "short", ...(options.year ? { year: "numeric" } : {}) })
    return options.time ? `${day}, ${date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}` : day
}

export type StatusTone = "attention" | "progress" | "done" | "neutral"

// Where one shop's part of an order stands, in the shopper's words.
export function describeBuyerStatus(order: ShopOrderState): { label: string, tone: StatusTone } {
    switch (order.status) {
        case "PAID":
            return { label: "Being prepared", tone: "progress" }
        case "SHIPPED":
            return order.deliveryReportedAt
                ? { label: "Confirm delivery", tone: "attention" }
                : { label: "On the way", tone: "progress" }
        case "DELIVERED":
            return { label: "Delivered", tone: "done" }
        default:
            return { label: formatOrderStatus(order.status), tone: "neutral" }
    }
}

// Paid, shipped and delivered orders show their progress; refunded and cancelled ones do not.
export function hasProgress(order: ShopOrderState): boolean {
    return ["PAID", "SHIPPED", "DELIVERED"].includes(order.status)
}

export type ProgressStep = { label: string, detail: string, state: "done" | "waiting" | "next" }

// Paid, shipped, delivered. While the shop says it was delivered and the shopper has not confirmed,
// the last step waits for them. withTime adds the time of day to each date.
export function buyerProgressSteps(order: ShopOrderState, paidAt: string | null, withTime = false): ProgressStep[] {
    const format = (isoTime: string | null | undefined) => formatOrderDay(isoTime, { time: withTime })
    const isDelivered = order.status === "DELIVERED"
    const isShipped = isDelivered || order.shippedAt !== null
    const isReported = !isDelivered && order.deliveryReportedAt !== null
    const deliveredDetail = format(order.deliveryConfirmedAt ?? order.deliveryAutoClosedAt)

    return [
        { label: "Paid", detail: format(paidAt), state: "done" },
        { label: "Shipped", detail: isShipped ? format(order.shippedAt) : "Not yet", state: isShipped ? "done" : "next" },
        isReported
            ? { label: "Delivered?", detail: `Shop says ${format(order.deliveryReportedAt)}`, state: "waiting" }
            : { label: "Delivered", detail: isDelivered ? deliveredDetail : "Not yet", state: isDelivered ? "done" : "next" }
    ]
}

// A complaint's reason, short enough for one line.
export const SHORT_COMPLAINT_REASONS: Record<string, string> = {
    NOT_RECEIVED: "order not received",
    NOT_AS_DESCRIBED: "item not as described",
    DAMAGED: "item arrived damaged",
    WRONG_ITEM: "wrong item sent",
    OTHER: "a problem with the order",
    SELLER_REFUND_OFFER: "refund offered by the shop"
}
