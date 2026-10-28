import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import { openDownload } from "./api"

// Something that has to be finished before the account can be deleted, for example an order still on the way.
export type DeletionBlocker = { code: string, message: string }
export type DeletionCheck = { canDelete: boolean, blockers: DeletionBlocker[] }

// Whether the signed-in account can be deleted now, and if not, what has to be finished first.
export function fetchDeletionCheck(signal?: AbortSignal): Promise<ApiResult<DeletionCheck>> {
    return apiRequest<DeletionCheck>("/users/me/deletion-check", {
        signal,
        isValid: (value): value is DeletionCheck => isRecord(value) && typeof value.canDelete === "boolean" && Array.isArray(value.blockers)
    })
}

// Saves everything StoreHatch holds about the signed-in person as a JSON file. Returns an error message, or null.
export function downloadMyData(): Promise<string | null> {
    return openDownload("/users/me/data")
}

// Deletes the signed-in account after the backend checks the password. The backend also ends every login.
export function deleteMyAccount(password: string): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>("/users/me/delete", { method: "POST", body: { password } })
}

// Reads the blockers the backend sends with a 409 when something changed since the page last checked.
export function readBlockers(body: unknown): DeletionBlocker[] {
    if (!isRecord(body) || !Array.isArray(body.blockers)) {
        return []
    }

    return body.blockers.filter((blocker): blocker is DeletionBlocker => isRecord(blocker) && typeof blocker.code === "string" && typeof blocker.message === "string")
}
