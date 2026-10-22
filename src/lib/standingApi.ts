import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type { SellerStanding } from "../types/standing"

type StandingBody = { standing: SellerStanding }

function isStandingBody(value: unknown): value is StandingBody {
    return isRecord(value) && isRecord(value.standing) && typeof value.standing.strikes === "number" && Array.isArray(value.standing.recent)
}

// The signed-in seller's own standing.
export function fetchMyStanding(signal?: AbortSignal): Promise<ApiResult<StandingBody>> {
    return apiRequest<StandingBody>("/seller/standing", { signal, isValid: isStandingBody })
}

// An administrator looks at a seller. `userId` is the seller's user number.
export function fetchSellerStanding(userId: number | string, signal?: AbortSignal): Promise<ApiResult<StandingBody>> {
    return apiRequest<StandingBody>(`/admin/sellers/${encodeURIComponent(String(userId))}/standing`, { signal, isValid: isStandingBody })
}

export function blockSeller(userId: number, note: string): Promise<ApiResult<StandingBody>> {
    return apiRequest<StandingBody>(`/admin/sellers/${userId}/block`, { method: "POST", body: { note }, isValid: isStandingBody })
}

// Lifting a block also starts the strike count again from zero.
export function unblockSeller(userId: number): Promise<ApiResult<StandingBody>> {
    return apiRequest<StandingBody>(`/admin/sellers/${userId}/unblock`, { method: "POST", body: {}, isValid: isStandingBody })
}
