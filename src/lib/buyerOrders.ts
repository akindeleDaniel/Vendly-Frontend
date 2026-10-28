import { formatOrderStatus } from "./orderApi"
import type { Fulfilment } from "../types/order"
import { LAGOS_TIME_ZONE, lagosParts } from "./lagosTime"

// What the shopper's order pages (My orders and an order's own page) show about one shop's part of an order.

type ShopOrderState = { status: string } & Fulfilment

// "25 Oct", with the year and the time when asked: "25 Oct 2026, 2:14 pm".
export function formatOrderDay(isoTime: string | null | undefined, options: { year?: boolean, time?: boolean } = {}): string {
    const date = isoTime ? new Date(isoTime) : null

    if (!date || Number.isNaN(date.getTime())) {
        return ""
    }

    const day = date.toLocaleDateString("en-NG", { timeZone: LAGOS_TIME_ZONE, day: "numeric", month: "short", ...(options.year ? { year: "numeric" } : {}) })
    return options.time ? `${day}, ${date.toLocaleTimeString("en-NG", { timeZone: LAGOS_TIME_ZONE, hour: "numeric", minute: "2-digit" })}` : day
}

// A pre-order's ready time as a calendar tile shows it ("SAT", "1", "NOV", "2:00 pm"), plus the
// whole of it in words ("Saturday 1 Nov, 2:00 pm").
export function readyTimeParts(isoTime: string): { weekday: string, day: string, month: string, time: string, long: string } {
    const date = new Date(isoTime)

    if (Number.isNaN(date.getTime())) {
        return { weekday: "", day: "", month: "", time: "", long: isoTime }
    }

    const time = date.toLocaleTimeString("en-NG", { timeZone: LAGOS_TIME_ZONE, hour: "numeric", minute: "2-digit" })
    const weekday = date.toLocaleDateString("en-NG", { timeZone: LAGOS_TIME_ZONE, weekday: "long" })
    const dayMonth = date.toLocaleDateString("en-NG", { timeZone: LAGOS_TIME_ZONE, day: "numeric", month: "short" })

    return {
        weekday: weekday.slice(0, 3).toUpperCase(),
        day: String(lagosParts(date).day),
        month: date.toLocaleDateString("en-NG", { timeZone: LAGOS_TIME_ZONE, month: "short" }).toUpperCase(),
        time,
        long: `${weekday} ${dayMonth}, ${time}`
    }
}

export type StatusTone ="attention" | "progress" | "done" | "neutral" | "bad"

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

// stopped: the step ended without going ahead (declined, rejected, withdrawn, lapsed).
export type ProgressStep = { label: string, detail: string, state: "done" | "waiting" | "next" | "stopped" }

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
