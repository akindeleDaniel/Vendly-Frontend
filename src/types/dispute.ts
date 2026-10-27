// Complaints (disputes) as returned by the backend. A complaint is about one seller's order.
// Money values are strings with two decimals.

export type DisputeStatus = "OPEN" | "SELLER_AGREED" | "UNDER_REVIEW" | "RESOLVED" | "WITHDRAWN"

export type DisputeOutcome = "REFUNDED" | "REJECTED"

export type DisputeReason =
    | "NOT_RECEIVED"
    | "NOT_AS_DESCRIBED"
    | "DAMAGED"
    | "WRONG_ITEM"
    | "OTHER"
    | "SELLER_REFUND_OFFER"

export type DisputeAuthor = "BUYER" | "SELLER" | "ADMIN" | "SYSTEM"

export type DisputeSummary = {
    id: number
    orderId: number
    checkoutId: number// the shopper's order page is /orders/:checkoutId
    unread?: boolean// in the buyer's and seller's lists: someone else wrote since this person last opened it
    reason: DisputeReason
    reasonLabel: string
    openedBy: "BUYER" | "SELLER"
    status: DisputeStatus
    outcome: DisputeOutcome | null
    requestedAmount: string | null
    approvedAmount: string | null
    orderTotal: string
    items: Array<{ title: string, quantity: number }>
    seller: { businessName: string } | null
    buyerName: string
    responseDueAt: string | null
    createdAt: string
    resolvedAt: string | null
    lastMessageAt: string | null
    lastMessageBy: DisputeAuthor | null
}

export type DisputeMessage = {
    id: number
    author: DisputeAuthor
    body: string
    evidenceUrls: string[]
    createdAt: string
}

// A refund as the people in a complaint see it. The reason is only sent to sellers and administrators.
export type DisputeRefund = {
    reference: string
    amount: string
    status: string
    note?: string | null
    reason?: string | null
    createdAt: string
    completedAt: string | null
}

export type Dispute = DisputeSummary & {
    decisionNote: string | null
    sellerRespondedAt: string | null
    escalatedAt: string | null
    order: {
        id: number
        status: string
        total: string
        seller: { businessName: string } | null
        items: Array<{ title: string, quantity: number, unitPrice: string, lineTotal: string }>
    }
    messages: DisputeMessage[]
    refunds: DisputeRefund[]
    // After StoreHatch rejects a complaint the buyer can appeal once, within 7 days. The second decision is final.
    appeal?: { canAppeal: boolean, appealed: boolean, deadline: string | null }
    buyer?: { name: string, email: string }
    sellerContact?: { email: string }
}

export type DisputePage = {
    page: number
    pageSize: number
    total: number
    disputes: DisputeSummary[]
}

// What an order list or detail says about an order's latest complaint.
export type OrderDisputeLink = {
    id: number
    status: DisputeStatus
    outcome: DisputeOutcome | null
    reason: DisputeReason
    requestedAmount?: string
    responseDueAt?: string// when the seller must reply by, while the complaint is OPEN
    createdAt?: string
}

export const DISPUTE_REASON_OPTIONS: Array<{ value: Exclude<DisputeReason, "SELLER_REFUND_OFFER">, label: string }> = [
    { value: "NOT_RECEIVED", label: "I did not receive my order" },
    { value: "NOT_AS_DESCRIBED", label: "The item is not as described" },
    { value: "DAMAGED", label: "The item arrived damaged" },
    { value: "WRONG_ITEM", label: "I received the wrong item" },
    { value: "OTHER", label: "Something else" }
]
