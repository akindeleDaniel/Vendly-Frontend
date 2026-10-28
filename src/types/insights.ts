// How a seller's shop is doing (GET /seller/summary) and who buys from it (GET /seller/customers).
// Money values are strings with two decimals. Days are Nigerian calendar days.

export type ViewCounts = { shop: number, products: number, total: number }

export type SummaryFigures = {
    orders: number
    sales: string
    refunded: string
    netSales: string // sales less refunds
    itemsSold: number
    customers: number // different buyers
    averageOrder: string | null // null without orders
    views: ViewCounts
}

export type SummaryProduct = {
    listingId: number
    title: string
    imageUrl: string | null
    onSale: boolean
}

export type SellerSummary = {
    from: string
    to: string
    totals: SummaryFigures
    previous: SummaryFigures & { from: string, to: string } // the period of the same length just before
    topProducts: Array<SummaryProduct & { quantity: number, sales: string, views: number }>
    mostViewed: Array<SummaryProduct & { views: number, orders: number, conversionRate: number | null }>
    days: Array<{ date: string, orders: number, sales: string, views: number }>
    needsAttention: {
        ordersToShip: number
        awaitingBuyerConfirmation: number
        complaintsToAnswer: number
        openComplaints: number
        preOrdersToAnswer: number
    }
}

export type CustomerSort = "recent" | "orders" | "spent"

export type SellerCustomer = {
    name: string // as reviews show it: "Ada O."
    orders: number
    spent: string
    refunded: string
    firstOrderAt: string
    lastOrderAt: string
    repeat: boolean // true from the second order
}

export type SellerCustomerPage = {
    page: number
    pageSize: number
    total: number
    counts: { customers: number, repeatCustomers: number }
    customers: SellerCustomer[]
}
