import { apiFetch, getErrorMessage } from "./api"
import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
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

// Saves the period's paid orders as a CSV file. The file is fetched with the login cookie, then handed
// to the browser as a download. Returns an error message, or null when it worked.
export async function downloadOrdersCsv(from: string, to: string): Promise<string | null> {
    try {
        const response = await apiFetch(`/seller/orders/export${periodQuery(from, to)}`, { credentials: "include" })

        if (!response.ok) {
            return await getErrorMessage(response, `The spreadsheet couldn't be made (status ${response.status}).`)
        }

        const blob = await response.blob()
        const named = /filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") ?? "")?.[1]
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = named ?? `storehatch-orders-${from}-to-${to}.csv`
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        return null
    } catch {
        return "The spreadsheet couldn't be downloaded. Please check your connection and try again."
    }
}
