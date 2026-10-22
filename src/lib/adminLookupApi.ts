import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type {
    AdminOrderDetail,
    AdminOrderPage,
    AdminSummary,
    AdminUserDetail,
    AdminUserPage
} from "../types/admin"
import type { Earnings } from "../types/earnings"

function hasKeys(...keys: string[]) {
    return (value: unknown): boolean => isRecord(value) && keys.every((key) => key in value)
}

export function fetchAdminSummary(signal?: AbortSignal): Promise<ApiResult<AdminSummary>> {
    return apiRequest<AdminSummary>("/admin/summary", {
        signal,
        isValid: (value): value is AdminSummary => hasKeys("complaints", "refunds", "recoveryCases", "liabilities")(value)
    })
}

export type AdminOrderFilters = {
    search: string
    status: string
    buyerId: string
    sellerId: string
    page: number
}

export function listAdminOrders(filters: AdminOrderFilters, signal?: AbortSignal): Promise<ApiResult<AdminOrderPage>> {
    const query = new URLSearchParams({ page: String(filters.page) })

    if (filters.search.trim()) query.set("search", filters.search.trim())
    if (filters.status) query.set("status", filters.status)
    if (filters.buyerId) query.set("buyerId", filters.buyerId)
    if (filters.sellerId) query.set("sellerId", filters.sellerId)

    return apiRequest<AdminOrderPage>(`/admin/orders?${query}`, {
        signal,
        isValid: (value): value is AdminOrderPage => hasKeys("orders", "total", "pageSize")(value) && Array.isArray((value as Record<string, unknown>).orders)
    })
}

export function fetchAdminOrder(id: string, signal?: AbortSignal): Promise<ApiResult<{ order: AdminOrderDetail }>> {
    return apiRequest<{ order: AdminOrderDetail }>(`/admin/orders/${encodeURIComponent(id)}`, {
        signal,
        isValid: (value): value is { order: AdminOrderDetail } => isRecord(value) && isRecord(value.order)
    })
}

export type AdminUserFilters = {
    search: string
    role: string
    adminsOnly: boolean
    page: number
}

export function listAdminUsers(filters: AdminUserFilters, signal?: AbortSignal): Promise<ApiResult<AdminUserPage>> {
    const query = new URLSearchParams({ page: String(filters.page) })

    if (filters.search.trim()) query.set("search", filters.search.trim())
    if (filters.role) query.set("role", filters.role)
    if (filters.adminsOnly) query.set("admin", "true")

    return apiRequest<AdminUserPage>(`/admin/users?${query}`, {
        signal,
        isValid: (value): value is AdminUserPage => hasKeys("users", "total", "pageSize")(value) && Array.isArray((value as Record<string, unknown>).users)
    })
}

export function fetchAdminUser(id: string, signal?: AbortSignal): Promise<ApiResult<{ user: AdminUserDetail }>> {
    return apiRequest<{ user: AdminUserDetail }>(`/admin/users/${encodeURIComponent(id)}`, {
        signal,
        isValid: (value): value is { user: AdminUserDetail } => isRecord(value) && isRecord(value.user)
    })
}

// The seller's own sales record. `from` and `to` are optional dates written YYYY-MM-DD.
export function fetchSellerEarnings(from: string, to: string, signal?: AbortSignal): Promise<ApiResult<Earnings>> {
    const query = new URLSearchParams()

    if (from) query.set("from", from)
    if (to) query.set("to", to)

    const suffix = query.toString()
    return apiRequest<Earnings>(`/seller/earnings${suffix ? `?${suffix}` : ""}`, {
        signal,
        isValid: (value): value is Earnings => hasKeys("totals", "months", "ordersByStatus", "owedToVendly")(value)
    })
}
