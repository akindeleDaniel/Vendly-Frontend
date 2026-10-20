// At or below this many in stock, a product says "Only N left".
export const LOW_STOCK_THRESHOLD = 3

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
