import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type { AuditLogPage, PlatformSummary, TeamMember } from "../types/platform"

type TeamBody = { team: TeamMember[] }

function isTeamBody(value: unknown): value is TeamBody {
    return isRecord(value) && Array.isArray(value.team)
}

export function fetchPlatformSummary(signal?: AbortSignal): Promise<ApiResult<PlatformSummary>> {
    return apiRequest<PlatformSummary>("/admin/platform", {
        signal,
        isValid: (value): value is PlatformSummary => isRecord(value) && isRecord(value.users) && isRecord(value.sales)
    })
}

export function fetchTeam(signal?: AbortSignal): Promise<ApiResult<TeamBody>> {
    return apiRequest<TeamBody>("/admin/team", { signal, isValid: isTeamBody })
}

// Changing the team asks for the acting person's own password every time.
export function addAdmin(email: string, password: string, superAdmin: boolean): Promise<ApiResult<TeamBody>> {
    return apiRequest<TeamBody>("/admin/team", { method: "POST", body: { email, password, superAdmin }, isValid: isTeamBody })
}

export function revokeAdmin(userId: number, password: string): Promise<ApiResult<TeamBody>> {
    return apiRequest<TeamBody>(`/admin/team/${userId}/revoke`, { method: "POST", body: { password }, isValid: isTeamBody })
}

export function setSuperAdmin(userId: number, value: boolean, password: string): Promise<ApiResult<TeamBody>> {
    return apiRequest<TeamBody>(`/admin/team/${userId}/super`, { method: "POST", body: { value, password }, isValid: isTeamBody })
}

export function fetchAuditLog(page: number, signal?: AbortSignal): Promise<ApiResult<AuditLogPage>> {
    return apiRequest<AuditLogPage>(`/admin/audit-log?page=${page}`, {
        signal,
        isValid: (value): value is AuditLogPage => isRecord(value) && Array.isArray(value.entries)
    })
}
