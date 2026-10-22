import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type { PreOrder, PreOrderPage, PreOrderStatus } from "../types/preOrder"

export type PreOrderViewer = "buyer" | "seller"

const BASE_PATHS: Record<PreOrderViewer, string> = {
    buyer: "/pre-orders",
    seller: "/seller/pre-orders"
}

function isPreOrderBody(value: unknown): value is { preOrder: PreOrder } {
    return isRecord(value) && isRecord(value.preOrder) && Number.isInteger(value.preOrder.id)
}

function isPreOrderPage(value: unknown): value is PreOrderPage {
    return isRecord(value) && Array.isArray(value.preOrders) && typeof value.total === "number"
}

// The buyer asks a food shop for what is in their cart from that shop. `readyAt` must carry its time
// zone (an ISO time ending in Z does).
export function askForPreOrder(sellerSlug: string, readyAt: string, note: string): Promise<ApiResult<{ preOrder: PreOrder }>> {
    return apiRequest<{ preOrder: PreOrder }>("/pre-orders", {
        method: "POST",
        body: { sellerSlug, readyAt, ...(note ? { note } : {}) },
        isValid: isPreOrderBody
    })
}

export function listPreOrders(viewer: PreOrderViewer, page: number, status: "" | PreOrderStatus, signal?: AbortSignal): Promise<ApiResult<PreOrderPage>> {
    const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) })
    return apiRequest<PreOrderPage>(`${BASE_PATHS[viewer]}?${query}`, { signal, isValid: isPreOrderPage })
}

export function getPreOrder(viewer: PreOrderViewer, id: string, signal?: AbortSignal): Promise<ApiResult<{ preOrder: PreOrder }>> {
    return apiRequest<{ preOrder: PreOrder }>(`${BASE_PATHS[viewer]}/${encodeURIComponent(id)}`, { signal, isValid: isPreOrderBody })
}

export function cancelPreOrder(id: number): Promise<ApiResult<{ preOrder: PreOrder }>> {
    return apiRequest<{ preOrder: PreOrder }>(`/pre-orders/${id}/cancel`, { method: "POST", body: {}, isValid: isPreOrderBody })
}

export function approvePreOrder(id: number, note: string): Promise<ApiResult<{ preOrder: PreOrder }>> {
    return apiRequest<{ preOrder: PreOrder }>(`/seller/pre-orders/${id}/approve`, {
        method: "POST",
        body: note ? { note } : {},
        isValid: isPreOrderBody
    })
}

export function declinePreOrder(id: number, note: string): Promise<ApiResult<{ preOrder: PreOrder }>> {
    return apiRequest<{ preOrder: PreOrder }>(`/seller/pre-orders/${id}/decline`, { method: "POST", body: { note }, isValid: isPreOrderBody })
}

// How many requests are waiting for the shop's answer. Null when it cannot be read, so the site
// simply shows no count.
export async function fetchPreOrdersAwaitingAnswer(signal?: AbortSignal): Promise<number | null> {
    const result = await apiRequest<{ count: number }>("/seller/pre-orders/awaiting-answer", {
        signal,
        isValid: (body): body is { count: number } => isRecord(body) && Number.isInteger(body.count)
    })
    return result.kind === "ok" ? result.data.count : null
}

export const PRE_ORDER_FILTERS: Array<{ value: "" | PreOrderStatus, label: string }> = [
    { value: "", label: "All" },
    { value: "REQUESTED", label: "Waiting for the shop" },
    { value: "APPROVED", label: "Approved" },
    { value: "DECLINED", label: "Declined" },
    { value: "EXPIRED", label: "Lapsed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "USED", label: "Paid for" }
]

type Tone = "neutral" | "attention" | "good" | "bad"

// What a request's status means to the person looking at it, and how loudly to show it.
export function describePreOrder(preOrder: Pick<PreOrder, "status">, viewer: PreOrderViewer): { label: string, tone: Tone } {
    switch (preOrder.status) {
        case "REQUESTED":
            return viewer === "seller"
                ? { label: "Needs your answer", tone: "attention" }
                : { label: "Waiting for the shop", tone: "neutral" }
        case "APPROVED":
            return viewer === "buyer"
                ? { label: "Approved, ready to pay", tone: "attention" }
                : { label: "Approved, waiting for payment", tone: "neutral" }
        case "DECLINED":
            return { label: "Declined", tone: "bad" }
        case "EXPIRED":
            return { label: "Lapsed", tone: "bad" }
        case "CANCELLED":
            return { label: "Cancelled", tone: "neutral" }
        case "USED":
            return { label: "Paid for", tone: "good" }
    }
}
