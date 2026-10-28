import { apiFetch, getErrorMessage } from "./api"
import type { CustomerOrder, Fulfilment, MyOrderFilter, MyOrderPage, OrderPage, SellerOrder, SellerOrderSummary } from "../types/order"
import { LAGOS_TIME_ZONE, lagosDay } from "./lagosTime"

export type OrderOutcome<T> =
    | { kind: "ok", data: T }
    | { kind: "not-found" }
    | { kind: "unauthorized" }
    | { kind: "error", message: string }

const NETWORK_MESSAGE = "We could not reach the server. Please check your connection and try again."

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isOrderPage(value: unknown): value is OrderPage<unknown> {
    return isRecord(value) && Number.isInteger(value.page) && Number.isInteger(value.total) && Array.isArray(value.orders)
}

function hasId(value: unknown): boolean {
    return isRecord(value) && Number.isInteger(value.id)
}

async function getOrders<T>(path: string, isValid: (body: unknown) => boolean, signal?: AbortSignal): Promise<OrderOutcome<T>> {
    let response: Response

    try {
        response = await apiFetch(path, { credentials: "include", signal })
    } catch {
        return { kind: "error", message: NETWORK_MESSAGE }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    if (response.status === 404) {
        return { kind: "not-found" }
    }

    if (!response.ok) {
        return { kind: "error", message: await getErrorMessage(response, `Unable to load orders (status ${response.status}).`) }
    }

    const body: unknown = await response.json().catch(() => null)
    return isValid(body)
        ? { kind: "ok", data: body as T }
        : { kind: "error", message: "We received an unexpected response from the server. Please try again." }
}

export function fetchMyOrders(page: number, status: MyOrderFilter, signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(page), ...(status !== "all" ? { status } : {}) })
    return getOrders<MyOrderPage>(`/orders?${query}`, isOrderPage, signal)
}

export function fetchMyOrder(id: string, signal?: AbortSignal) {
    return getOrders<CustomerOrder>(`/orders/${encodeURIComponent(id)}`, hasId, signal)
}

export function fetchSellerOrders(page: number, status: string, complaint: string, signal?: AbortSignal) {
    const query = new URLSearchParams({
        page: String(page),
        ...(status ? { status } : {}),
        ...(complaint ? { complaint } : {})
    })
    return getOrders<OrderPage<SellerOrderSummary>>(`/seller/orders?${query}`, isOrderPage, signal)
}

export function fetchSellerOrder(id: string, signal?: AbortSignal) {
    return getOrders<SellerOrder>(`/seller/orders/${encodeURIComponent(id)}`, hasId, signal)
}

export type ActionOutcome<T> =
    | { kind: "ok", data: T }
    | { kind: "refused", message: string }// the order is not in a state that allows this
    | { kind: "not-found" }
    | { kind: "unauthorized" }
    | { kind: "error", message: string }

async function postOrderAction<T>(path: string, body?: unknown): Promise<ActionOutcome<T>> {
    let response: Response

    try {
        response = await apiFetch(path, {
            method: "POST",
            credentials: "include",
            ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
        })
    } catch {
        return { kind: "error", message: NETWORK_MESSAGE }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    if (response.status === 404) {
        return { kind: "not-found" }
    }

    if (response.status === 409) {
        return { kind: "refused", message: await getErrorMessage(response, "This order cannot be updated right now.") }
    }

    if (!response.ok) {
        return { kind: "error", message: await getErrorMessage(response, `Unable to update the order (status ${response.status}).`) }
    }

    const data: unknown = await response.json().catch(() => null)
    return hasId(data)
        ? { kind: "ok", data: data as T }
        : { kind: "error", message: "We received an unexpected response from the server. Please try again." }
}

// The seller marks a paid order as shipped, with an optional note for the buyer.
export function markOrderShipped(orderId: number, note: string) {
    return postOrderAction<SellerOrder>(`/seller/orders/${orderId}/ship`, note.trim() ? { note: note.trim() } : {})
}

// The seller reports delivery. The buyer still has to confirm it.
export function reportOrderDelivered(orderId: number) {
    return postOrderAction<SellerOrder>(`/seller/orders/${orderId}/delivered`, {})
}

// The buyer confirms they received one seller's order, which is what makes it delivered.
export function confirmOrderReceived(checkoutId: number, orderId: number) {
    return postOrderAction<CustomerOrder>(`/orders/${checkoutId}/seller-orders/${orderId}/confirm-delivery`)
}

// How many orders the seller has reported delivered that the buyer has not yet confirmed. Returns
// null when it cannot be read, so the site simply shows no count.
export async function fetchAwaitingConfirmationCount(signal?: AbortSignal): Promise<number | null> {
    try {
        const response = await apiFetch("/orders/awaiting-confirmation", { credentials: "include", signal })
        const body: unknown = response.ok ? await response.json() : null
        return isRecord(body) && Number.isInteger(body.count) ? body.count as number : null
    } catch {
        return null
    }
}

const statusLabels: Record<string, string> = {
    COMPLETED: "Paid",
    PAID: "Paid",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    REFUNDED: "Refunded",
    CANCELLED: "Cancelled",
    PENDING_PAYMENT: "Awaiting payment",
    PAYMENT_PENDING: "Payment being confirmed"
}

export function formatOrderStatus(status: string): string {
    return statusLabels[status] ?? status
}

// What an order's status means to the person looking at it. A seller's "delivered" report is shown
// as awaiting the buyer's confirmation; only the buyer's confirmation makes it delivered.
export function describeOrderStatus(order: { status: string } & Pick<Fulfilment, "deliveryReportedAt">, viewer: "buyer" | "seller"): string {
    if (order.status === "SHIPPED" && order.deliveryReportedAt) {
        return viewer === "buyer" ? "Delivered, please confirm" : "Delivered, awaiting buyer confirmation"
    }

    if (order.status === "PAID" && viewer === "seller") {
        return "Paid, ready to ship"
    }

    return formatOrderStatus(order.status)
}

// A short date and time for the progress steps, such as "19 Oct 2026, 1:53 pm".
// "3:42 PM", with the day when it is not today: how long checkout holds the items.
export function formatHeldUntil(isoTime: string): string {
    const date = new Date(isoTime)
    if (Number.isNaN(date.getTime())) {
        return isoTime
    }
    const time = date.toLocaleTimeString("en-NG", { timeZone: LAGOS_TIME_ZONE, hour: "numeric", minute: "2-digit" })
    return lagosDay(date) === lagosDay() ? time : `${time} on ${date.toLocaleDateString("en-NG", { timeZone: LAGOS_TIME_ZONE, day: "numeric", month: "short" })}`
}

export function formatShortDate(isoTime: string): string {
    const date = new Date(isoTime)
    return Number.isNaN(date.getTime())
        ? isoTime
        : date.toLocaleString("en-NG", { timeZone: LAGOS_TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

// True when a money string from the server is more than zero, for showing a line only when it matters.
export function hasAmount(amount: string | null | undefined): boolean {
    return typeof amount === "string" && /[1-9]/.test(amount)
}

export function formatProvider(provider: string | null | undefined): string {
    return provider === "PAYSTACK" ? "Paystack" : provider === "FLUTTERWAVE" ? "Flutterwave" : "—"
}

export function formatDate(isoTime: string | null): string {
    if (!isoTime) {
        return "—"
    }

    const date = new Date(isoTime)
    return Number.isNaN(date.getTime()) ? isoTime : date.toLocaleString("en-NG", { timeZone: LAGOS_TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}
