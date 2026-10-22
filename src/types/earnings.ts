// GET /seller/earnings. Money values are naira strings with two decimals. These are the figures the
// payment providers reported for each order, so they are a sales record, not a bank statement.

export type EarningsMonth = {
    month: string// for example "2026-10"
    orders: number
    sales: string
    providerFees: string
    paidOutByProvider: string
    refunded: string
}

export type Earnings = {
    from: string | null
    to: string | null
    totals: {
        orders: number
        sales: string
        providerFees: string
        paidOutByProvider: string
        refunded: string
        keptForEarlierRefunds: string
        ordersWithoutProviderFigures: number
    }
    ordersByStatus: Record<string, number>
    owedToVendly: { count: number, amountStillOwed: string }
    months: EarningsMonth[]// the last twelve months, newest first, whatever the date range
}
