import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import { downloadFile } from "./productBulkApi"
import type { CustomerSort, SellerCustomerPage, SellerSummary } from "../types/insights"

function periodQuery(from: string, to: string): string {
    const query = new URLSearchParams()
    if (from) query.set("from", from)
    if (to) query.set("to", to)
    const text = query.toString()
    return text ? `?${text}` : ""
}

// The shop's figures for a period, with the period just before for comparison.
export function fetchSellerSummary(from: string, to: string, signal?: AbortSignal): Promise<ApiResult<SellerSummary>> {
    return apiRequest<SellerSummary>(`/seller/summary${periodQuery(from, to)}`, {
        signal,
        isValid: (value): value is SellerSummary => isRecord(value) && isRecord(value.totals) && Array.isArray(value.days)
    })
}

// Everyone who has paid for an order from the shop, 20 to a page.
export function fetchSellerCustomers(sort: CustomerSort, page: number, signal?: AbortSignal): Promise<ApiResult<SellerCustomerPage>> {
    return apiRequest<SellerCustomerPage>(`/seller/customers?sort=${sort}&page=${page}`, {
        signal,
        isValid: (value): value is SellerCustomerPage => isRecord(value) && Array.isArray(value.customers) && isRecord(value.counts)
    })
}

// Saves the period's paid orders as a CSV file. Returns an error message, or null when it worked.
export function downloadOrdersCsv(from: string, to: string): Promise<string | null> {
    return downloadFile(`/seller/orders/export${periodQuery(from, to)}`, `storehatch-orders-${from}-to-${to}.csv`)
}
