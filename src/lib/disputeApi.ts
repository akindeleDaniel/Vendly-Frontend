import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type { AdminRefund } from "../types/refund"
import type { Dispute, DisputePage, DisputeStatus } from "../types/dispute"

export type DisputeViewer = "buyer" | "seller" | "admin"

const BASE_PATHS: Record<DisputeViewer, string> = {
    buyer: "/disputes",
    seller: "/seller/disputes",
    admin: "/admin/disputes"
}

type DisputeBody = { dispute: Dispute }

function isDisputePage(value: unknown): value is DisputePage {
    return (
        isRecord(value) &&
        Array.isArray(value.disputes) &&
        Number.isInteger(value.total) &&
        Number.isInteger(value.pageSize)
    )
}

function isDisputeBody(value: unknown): value is DisputeBody {
    return (
        isRecord(value) &&
        isRecord(value.dispute) &&
        Number.isInteger(value.dispute.id) &&
        Array.isArray(value.dispute.messages)
    )
}

// Evidence links and the amount are only sent when there is something to send.
function withOptional(body: Record<string, unknown>, evidenceUrls: string[], amount?: string) {
    return {
        ...body,
        ...(evidenceUrls.length > 0 ? { evidenceUrls } : {}),
        ...(amount ? { amount } : {})
    }
}

export function listDisputes(viewer: DisputeViewer, page: number, status: string, signal?: AbortSignal): Promise<ApiResult<DisputePage>> {
    const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) })
    return apiRequest<DisputePage>(`${BASE_PATHS[viewer]}?${query}`, { signal, isValid: isDisputePage })
}

export function getDispute(viewer: DisputeViewer, id: string, signal?: AbortSignal): Promise<ApiResult<DisputeBody>> {
    return apiRequest<DisputeBody>(`${BASE_PATHS[viewer]}/${encodeURIComponent(id)}`, { signal, isValid: isDisputeBody })
}

export function postDisputeMessage(viewer: DisputeViewer, id: number, message: string, evidenceUrls: string[]): Promise<ApiResult<DisputeBody>> {
    return apiRequest<DisputeBody>(`${BASE_PATHS[viewer]}/${id}/messages`, {
        method: "POST",
        body: withOptional({ message }, evidenceUrls),
        isValid: isDisputeBody
    })
}

// A buyer withdraws their own complaint; a seller withdraws their own refund offer.
export function withdrawDispute(viewer: "buyer" | "seller", id: number): Promise<ApiResult<DisputeBody>> {
    return apiRequest<DisputeBody>(`${BASE_PATHS[viewer]}/${id}/withdraw`, { method: "POST", body: {}, isValid: isDisputeBody })
}

export type OpenDisputeInput = {
    reason: string
    message: string
    evidenceUrls: string[]
    amount?: string
}

export function openDispute(checkoutId: number, orderId: number, input: OpenDisputeInput): Promise<ApiResult<DisputeBody>> {
    return apiRequest<DisputeBody>(`/orders/${checkoutId}/seller-orders/${orderId}/disputes`, {
        method: "POST",
        body: withOptional({ reason: input.reason, message: input.message }, input.evidenceUrls, input.amount),
        isValid: isDisputeBody
    })
}

export function respondToDispute(id: number, action: "AGREE_TO_REFUND" | "DISAGREE", message: string, evidenceUrls: string[]): Promise<ApiResult<DisputeBody>> {
    return apiRequest<DisputeBody>(`/seller/disputes/${id}/respond`, {
        method: "POST",
        body: withOptional({ action, message }, evidenceUrls),
        isValid: isDisputeBody
    })
}

export function offerRefund(orderId: number, message: string, evidenceUrls: string[], amount?: string): Promise<ApiResult<DisputeBody>> {
    return apiRequest<DisputeBody>(`/seller/orders/${orderId}/refund-offer`, {
        method: "POST",
        body: withOptional({ message }, evidenceUrls, amount),
        isValid: isDisputeBody
    })
}

// How many complaints are waiting for the seller's answer. Null when it cannot be read, so the
// site simply shows no count.
export async function fetchComplaintsAwaitingSeller(signal?: AbortSignal): Promise<number | null> {
    const result = await apiRequest<{ count: number }>("/seller/disputes/awaiting-response", {
        signal,
        isValid: (body): body is { count: number } => isRecord(body) && Number.isInteger(body.count)
    })
    return result.kind === "ok" ? result.data.count : null
}

// How many complaints have something new for this person. Null when it cannot be read, so the site
// simply shows no count.
export async function fetchUnreadComplaintCount(viewer: "buyer" | "seller", signal?: AbortSignal): Promise<number | null> {
    const path = viewer === "seller" ? "/seller/disputes/unread" : "/disputes/unread"
    const result = await apiRequest<{ count: number }>(path, {
        signal,
        isValid: (body): body is { count: number } => isRecord(body) && Number.isInteger(body.count)
    })
    return result.kind === "ok" ? result.data.count : null
}

export type ApproveDisputeInput = {
    note: string
    amount?: string
    customerNote?: string
    restock?: boolean
    chargeSeller?: boolean
    acknowledgeLowBalance?: boolean
}

export function approveDispute(id: number, input: ApproveDisputeInput): Promise<ApiResult<{ dispute: Dispute, refund: AdminRefund }>> {
    return apiRequest<{ dispute: Dispute, refund: AdminRefund }>(`/admin/disputes/${id}/approve`, {
        method: "POST",
        body: {
            note: input.note,
            ...(input.amount ? { amount: input.amount } : {}),
            ...(input.customerNote ? { customerNote: input.customerNote } : {}),
            ...(input.restock !== undefined ? { restock: input.restock } : {}),
            ...(input.chargeSeller !== undefined ? { chargeSeller: input.chargeSeller } : {}),
            ...(input.acknowledgeLowBalance ? { acknowledgeLowBalance: true } : {})
        }
    })
}

export function rejectDispute(id: number, note: string): Promise<ApiResult<DisputeBody>> {
    return apiRequest<DisputeBody>(`/admin/disputes/${id}/reject`, { method: "POST", body: { note }, isValid: isDisputeBody })
}

export const DISPUTE_FILTERS: Array<{ value: "" | DisputeStatus, label: string }> = [
    { value: "", label: "All" },
    { value: "OPEN", label: "Waiting for the seller" },
    { value: "SELLER_AGREED", label: "Seller agreed" },
    { value: "UNDER_REVIEW", label: "Under review" },
    { value: "RESOLVED", label: "Resolved" },
    { value: "WITHDRAWN", label: "Withdrawn" }
]

export function isDisputeClosed(status: DisputeStatus): boolean {
    return status === "RESOLVED" || status === "WITHDRAWN"
}

type BadgeTone = "neutral" | "attention" | "good" | "bad"

// What a complaint's status means to the person looking at it, and how loudly to show it.
export function describeDispute(
    dispute: { status: DisputeStatus, outcome: string | null, openedBy?: "BUYER" | "SELLER" },
    viewer: DisputeViewer
): { label: string, tone: BadgeTone } {
    switch (dispute.status) {
        case "OPEN":
            return viewer === "seller"
                ? { label: "Needs your response", tone: "attention" }
                : { label: "Waiting for the seller", tone: "neutral" }
        case "SELLER_AGREED":
            return viewer === "admin"
                ? { label: "Seller agreed, needs a decision", tone: "attention" }
                : viewer === "seller"
                    ? { label: "You agreed, waiting for Vendly", tone: "neutral" }
                    : { label: "Seller agreed, waiting for Vendly", tone: "neutral" }
        case "UNDER_REVIEW":
            return viewer === "admin"
                ? { label: "Needs a decision", tone: "attention" }
                : { label: "Vendly is reviewing", tone: "neutral" }
        case "RESOLVED":
            return dispute.outcome === "REFUNDED"
                ? { label: "Refunded", tone: "good" }
                : { label: "Rejected", tone: "bad" }
        case "WITHDRAWN":
            return { label: "Withdrawn", tone: "neutral" }
    }
}
