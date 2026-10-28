// Refunds, seller liabilities and recovery cases (the administrator's side of money going back).
// Money values are strings with two decimals.

export type RefundStatus = "PENDING" | "PROCESSING" | "NEEDS_ATTENTION" | "SUCCEEDED" | "FAILED"

// A refund as the buyer sees it on an order. The administrator's reason is never sent to the buyer.
export type BuyerRefund = {
    reference: string
    amount: string
    status: RefundStatus
    note: string | null
    expectedAt: string | null
    createdAt: string
    completedAt: string | null
}

// A refund as the seller sees it on an order.
export type SellerRefund = {
    reference: string
    amount: string
    status: RefundStatus
    reason: string
    createdAt: string
    completedAt: string | null
}

export type LiabilityStatus = "OPEN" | "CLEARED" | "WRITTEN_OFF" | "VOID"

export type LiabilityRecovery = {
    orderId: number | null// null when the money was collected by hand
    amount: string
    note: string | null
    createdAt: string
}

export type SellerLiability = {
    id: number
    orderId: number | null
    reason: string | null
    amount: string
    recovered: string
    remaining: string
    status: LiabilityStatus
    createdAt: string
    closedAt: string | null
    recoveries: LiabilityRecovery[]
}

// GET /seller/liabilities
export type SellerLiabilities = {
    termsAccepted: boolean
    feeTerms: { version: string, text: string }
    deductionCapPercent: number
    outstanding: string
    liabilities: SellerLiability[]
}

export type AdminRefund = {
    id: number
    reference: string
    orderId: number | null// null for a refund of a whole payment
    paymentReference: string
    provider: "PAYSTACK" | "FLUTTERWAVE"
    providerRefundId?: string | null// the provider's own number for the refund, once it has one
    amount: string
    currency: string
    status: RefundStatus
    providerStatus: string | null
    awaitingFunds: boolean
    expectedAt: string | null
    reason: string
    customerNote: string | null
    restock: boolean
    restockedAt: string | null
    chargeSeller: boolean
    failureReason: string | null
    createdAt: string
    completedAt: string | null
    liability: { id: number, amount: string, recovered: string, status: LiabilityStatus } | null
}

export type AdminRefundPage = {
    page: number
    pageSize: number
    total: number
    refunds: AdminRefund[]
}

export type RecoveryCase = {
    id: number
    status: "OPEN" | "RESOLVED"
    reason: string
    resolutionNote: string | null
    createdAt: string
    resolvedAt: string | null
    payment: {
        id: number
        reference: string
        provider: "PAYSTACK" | "FLUTTERWAVE"
        amount: string
        currency: string
        checkoutId: number
        buyer: { name: string, email: string }
    }
}

export type AdminLiability = {
    id: number
    sellerId: number
    seller: { name: string, email: string }
    orderId: number | null
    refundReference: string | null
    refundStatus: RefundStatus | null
    reason: string | null
    amount: string
    recovered: string
    remaining: string
    status: LiabilityStatus
    note: string | null
    createdAt: string
    closedAt: string | null
    recoveries: LiabilityRecovery[]
}
