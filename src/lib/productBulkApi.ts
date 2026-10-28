import { apiFetch, getErrorMessage } from "./api"
import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type { Listing } from "../types/listing"

// Many products at once: drafts made from photos, publishing them, the quick edit of prices and stock,
// and importing a spreadsheet (listingController, listingBulkController in the backend).

// The seller's drafts, newest first. Each says what it still needs in draftMissing.
export function fetchDrafts(signal?: AbortSignal): Promise<ApiResult<Listing[]>> {
    return apiRequest<Listing[]>("/listings/Mylisting?drafts=only", { signal, isValid: (value): value is Listing[] => Array.isArray(value) })
}

export type NewDraft = { imageUrl: string, title?: string }

// One draft for each uploaded photo (1 to 50).
export function createDrafts(photos: NewDraft[]): Promise<ApiResult<{ count: number, drafts: Array<{ listingId: number, title: string }> }>> {
    return apiRequest("/listings/drafts", { method: "POST", body: { photos } })
}

export type FieldProblem = { listingId: number, field: string, message: string }

// Puts the complete drafts on sale; the others come back with what they need.
export function publishDrafts(listingIds: number[]): Promise<ApiResult<{ published: number[], problems: FieldProblem[] }>> {
    return apiRequest("/listings/drafts/publish", { method: "POST", body: { listingIds } })
}

export type BulkChange = {
    listingId: number
    price?: number
    stockQuantity?: number
    title?: string
    description?: string
    category?: string
    lowStockThreshold?: number | null
}

// Saves many changes together, or none of them. Problems come back per product and field.
export function saveBulkChanges(changes: BulkChange[]): Promise<ApiResult<{ count: number }>> {
    return apiRequest("/listings/bulk", { method: "PATCH", body: { changes } })
}

// The per-product problems of a refused bulk save (BULK_INVALID, or BULK_STOCK_RESERVED when stock
// would go below what shoppers are paying for).
export function readFieldProblems(result: ApiResult<unknown>): FieldProblem[] {
    if (result.kind !== "failed" || !isRecord(result.body) || !Array.isArray(result.body.problems)) {
        return []
    }

    return result.body.problems.flatMap((problem): FieldProblem[] => isRecord(problem) && typeof problem.listingId === "number"
        ? [{ listingId: problem.listingId, field: typeof problem.field === "string" ? problem.field : "", message: typeof problem.message === "string" ? problem.message : "This can't be saved." }]
        : [])
}

export type ImportProduct = {
    row: number
    title: string
    price: number | string | null
    stockQuantity: number | null
    category?: string | null
    imageUrl: string | null
    photos?: number | string[]
    options?: number
}

export type ImportWarning = { row: number, column: string, message: string }
export type ImportProblem = { row: number, column: string, message: string }

export type ImportCheck = {
    dryRun: true
    source?: "storehatch" | "shopify"
    asDrafts?: boolean
    count: number
    products: ImportProduct[]
    warnings: ImportWarning[]
}

export type ImportSaved = {
    source?: "storehatch" | "shopify"
    asDrafts?: boolean
    count: number
    listings?: Array<{ id: number, title: string }>
    drafts?: Array<{ listingId: number, title: string }>
    warnings: ImportWarning[]
}

// Checks a spreadsheet (dryRun) or adds its products. The file's text is sent as it is.
export function checkImport(csv: string): Promise<ApiResult<ImportCheck>> {
    return apiRequest<ImportCheck>("/listings/import", {
        method: "POST",
        body: { csv, dryRun: true },
        isValid: (value): value is ImportCheck => isRecord(value) && Array.isArray(value.products)
    })
}

export function saveImport(csv: string): Promise<ApiResult<ImportSaved>> {
    return apiRequest<ImportSaved>("/listings/import", { method: "POST", body: { csv } })
}

// The rows and columns of a refused import (IMPORT_INVALID).
export function readImportProblems(result: ApiResult<unknown>): ImportProblem[] {
    if (result.kind !== "failed" || !isRecord(result.body) || !Array.isArray(result.body.problems)) {
        return []
    }

    return result.body.problems.flatMap((problem): ImportProblem[] => isRecord(problem)
        ? [{ row: typeof problem.row === "number" ? problem.row : 0, column: typeof problem.column === "string" ? problem.column : "", message: typeof problem.message === "string" ? problem.message : "" }]
        : [])
}

// Fetches a file with the login cookie and hands it to the browser as a download. Returns an error
// message, or null when it worked.
export async function downloadFile(path: string, fallbackName: string): Promise<string | null> {
    try {
        const response = await apiFetch(path, { credentials: "include" })

        if (!response.ok) {
            return await getErrorMessage(response, `The file couldn't be downloaded (status ${response.status}).`)
        }

        const blob = await response.blob()
        const named = /filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") ?? "")?.[1]
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = named ?? fallbackName
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        return null
    } catch {
        return "The file couldn't be downloaded. Please check your connection and try again."
    }
}
