// Read-only administrator lookups. Money values are strings with two decimals.

export type AdminSummary = {
    complaints: { awaitingSeller: number, awaitingDecision: number }
    refunds: { pending: number, processing: number, needsAttention: number, failed: number }
    recoveryCases: { open: number }
    liabilities: { open: number, amountStillOwed: string }
}

export type AdminPerson = { id: number, name: string, email: string }

export type AdminOrderRow = {
    id: number
    checkoutId: number
    status: string
    createdAt: string
    total: string
    refundedAmount: string
    buyer: AdminPerson
    seller: { id: number, email: string, businessName: string | null }
    itemCount: number
    items: Array<{ title: string, quantity: number }>
    complaint: { id: number, status: string } | null
}

export type AdminOrderPage = {
    page: number
    pageSize: number
    total: number
    orders: AdminOrderRow[]
}

export type AdminOrderDetail = {
    id: number
    checkoutId: number
    status: string
    createdAt: string
    subtotal: string
    shippingCost: string
    total: string
    providerFee: string | null
    sellerReceives: string | null
    refundedAmount: string
    liabilityDeduction: string
    items: Array<{ listingId: number, title: string, quantity: number, unitPrice: string, lineTotal: string }>
    buyer: AdminPerson
    seller: { id: number, email: string, businessName: string | null, slug: string | null }
    delivery: { name: string, phone: string, address: string, state: string, lga: string, instructions: string | null }
    fulfilment: {
        shippedAt: string | null
        shippingNote: string | null
        deliveryReportedAt: string | null
        deliveryConfirmedAt: string | null
        deliveryAutoClosedAt: string | null
    }
    checkoutStatus: string
    payments: Array<{
        id: number
        provider: "PAYSTACK" | "FLUTTERWAVE"
        reference: string
        providerReference: string | null
        status: string
        amount: string
        providerStatus: string | null
        failureReason: string | null
        verifiedAt: string | null
        createdAt: string
        recoveryCase: { id: number, status: string, reason: string } | null
    }>
    refunds: Array<{
        id: number
        reference: string
        amount: string
        status: string
        reason: string
        createdAt: string
        completedAt: string | null
    }>
    complaints: Array<{ id: number, status: string, outcome: string | null, reason: string, createdAt: string }>
}

export type AdminUserRow = {
    id: number
    name: string
    email: string
    role: "CONSUMER" | "SELLER"
    isAdmin: boolean
    emailConfirmed: boolean
    usesGoogle: boolean
    createdAt: string
    shop: { businessName: string, slug: string } | null
}

export type AdminUserPage = {
    page: number
    pageSize: number
    total: number
    users: AdminUserRow[]
}

export type AdminUserDetail = AdminUserRow & {
    ordersAsBuyer: number
    ordersAsSeller: number
    activeComplaints: number
    openLiabilities: { count: number, amountStillOwed: string }
}
