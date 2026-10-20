import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type { AdminLiability, AdminRefund, AdminRefundPage, RecoveryCase } from "../types/refund"

function hasList(key: string) {
    return (value: unknown): boolean => isRecord(value) && Array.isArray(value[key])
}

function isRefundPage(value: unknown): value is AdminRefundPage {
    return hasList("refunds")(value) && Number.isInteger((value as Record<string, unknown>).total)
}

function isRefundBody(value: unknown): value is { refund: AdminRefund } {
    return isRecord(value) && isRecord(value.refund) && Number.isInteger(value.refund.id)
}

export function listAdminRefunds(page: number, status: string, signal?: AbortSignal): Promise<ApiResult<AdminRefundPage>> {
    const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) })
    return apiRequest<AdminRefundPage>(`/admin/refunds?${query}`, { signal, isValid: isRefundPage })
}

// Asks the payment provider where a refund stands now.
export function syncAdminRefund(id: number): Promise<ApiResult<{ refund: AdminRefund }>> {
    return apiRequest<{ refund: AdminRefund }>(`/admin/refunds/${id}/sync`, { method: "POST", body: {}, isValid: isRefundBody })
}

export type IssueRefundInput = {
    reason: string
    amount?: string
    customerNote?: string
    restock?: boolean
    chargeSeller?: boolean
    acknowledgeLowBalance?: boolean
}

function refundBody(input: IssueRefundInput) {
    return {
        reason: input.reason,
        ...(input.amount ? { amount: input.amount } : {}),
        ...(input.customerNote ? { customerNote: input.customerNote } : {}),
        ...(input.restock !== undefined ? { restock: input.restock } : {}),
        ...(input.chargeSeller !== undefined ? { chargeSeller: input.chargeSeller } : {}),
        ...(input.acknowledgeLowBalance ? { acknowledgeLowBalance: true } : {})
    }
}

export function issueAdminRefund(orderId: number, input: IssueRefundInput): Promise<ApiResult<{ refund: AdminRefund }>> {
    return apiRequest<{ refund: AdminRefund }>(`/admin/orders/${orderId}/refunds`, {
        method: "POST",
        body: refundBody(input),
        isValid: isRefundBody
    })
}

export function listRecoveryCases(status: string, signal?: AbortSignal): Promise<ApiResult<{ cases: RecoveryCase[] }>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : ""
    return apiRequest<{ cases: RecoveryCase[] }>(`/admin/recovery-cases${query}`, {
        signal,
        isValid: (value): value is { cases: RecoveryCase[] } => hasList("cases")(value)
    })
}

// Refunds the whole payment behind a recovery case.
export function refundRecoveryCase(id: number, input: { reason?: string, customerNote?: string, acknowledgeLowBalance?: boolean }): Promise<ApiResult<{ refund: AdminRefund }>> {
    return apiRequest<{ refund: AdminRefund }>(`/admin/recovery-cases/${id}/refund`, {
        method: "POST",
        body: {
            ...(input.reason ? { reason: input.reason } : {}),
            ...(input.customerNote ? { customerNote: input.customerNote } : {}),
            ...(input.acknowledgeLowBalance ? { acknowledgeLowBalance: true } : {})
        },
        isValid: isRefundBody
    })
}

// Closes a recovery case that was handled another way.
export function resolveRecoveryCase(id: number, note: string): Promise<ApiResult<{ case: RecoveryCase }>> {
    return apiRequest<{ case: RecoveryCase }>(`/admin/recovery-cases/${id}/resolve`, {
        method: "POST",
        body: { note },
        isValid: (value): value is { case: RecoveryCase } => isRecord(value) && isRecord(value.case)
    })
}

export function listAdminLiabilities(status: string, signal?: AbortSignal): Promise<ApiResult<{ liabilities: AdminLiability[] }>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : ""
    return apiRequest<{ liabilities: AdminLiability[] }>(`/admin/liabilities${query}`, {
        signal,
        isValid: (value): value is { liabilities: AdminLiability[] } => hasList("liabilities")(value)
    })
}

function isLiabilityBody(value: unknown): value is { liability: AdminLiability } {
    return isRecord(value) && isRecord(value.liability) && Number.isInteger(value.liability.id)
}

export function recordManualRecovery(id: number, amount: string, note: string): Promise<ApiResult<{ liability: AdminLiability }>> {
    return apiRequest<{ liability: AdminLiability }>(`/admin/liabilities/${id}/manual-recovery`, {
        method: "POST",
        body: { amount, note },
        isValid: isLiabilityBody
    })
}

export function writeOffLiability(id: number, note: string): Promise<ApiResult<{ liability: AdminLiability }>> {
    return apiRequest<{ liability: AdminLiability }>(`/admin/liabilities/${id}/write-off`, {
        method: "POST",
        body: { note },
        isValid: isLiabilityBody
    })
}
