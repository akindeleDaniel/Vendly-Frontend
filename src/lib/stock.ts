import type { Listing, LowStockOption, StockStatus } from "../types/listing"

// At or below this many in stock, a product says "Only N left" to shoppers. It is also the shop's
// low-stock alert number until the seller changes it.
export const LOW_STOCK_THRESHOLD = 3
export const ALERT_MAX = 1000// the backend takes 0 to 1000; 0 turns the alerts off

// Where one of the seller's products stands. The backend works it out from the alert numbers; an older
// response without it falls back to the shoppers' "only a few left" number.
export function sellerStockStatus(listing: Listing): StockStatus {
    if (listing.stockStatus) {
        return listing.stockStatus
    }

    return listing.stockQuantity === 0 ? "sold_out" : listing.stockQuantity <= LOW_STOCK_THRESHOLD ? "low" : "in_stock"
}

// "White / 42": the option and size of a low-stock option.
export function lowOptionName(option: LowStockOption): string {
    return [option.optionLabel, option.sizeLabel].filter(Boolean).join(" / ") || "One option"
}

// The alert line under a product's stock on My store: "Alert at 3", "Alert at 2, its own number" or "No alerts".
export function describeAlert(listing: Listing): string | null {
    if (listing.effectiveLowStockThreshold === undefined) {
        return null
    }

    if (listing.effectiveLowStockThreshold === 0) {
        return "No alerts"
    }

    const own = listing.lowStockThreshold !== null && listing.lowStockThreshold !== undefined
    return `Alert at ${listing.effectiveLowStockThreshold}${own ? ", its own number" : listing.hasOptions ? " for each option" : ""}`
}

// How a product's stock is described to a shopper.
export function describeStock(stockQuantity: number): { label: string, isLow: boolean, isSoldOut: boolean } {
    if (stockQuantity === 0) {
        return { label: "Not available right now", isLow: false, isSoldOut: true }
    }

    if (stockQuantity <= LOW_STOCK_THRESHOLD) {
        return { label: `Only ${stockQuantity} left`, isLow: true, isSoldOut: false }
    }

    return { label: `${stockQuantity} available`, isLow: false, isSoldOut: false }
}
