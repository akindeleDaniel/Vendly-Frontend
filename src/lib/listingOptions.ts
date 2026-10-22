import type { Listing, ListingOption, ListingSize } from "../types/listing"

// A product's options (colours) and their sizes. What a shopper buys is one choice: an option that has
// no sizes, or one size of an option. Its `listingId` is what goes in the cart.

export type BuyableChoice = { id: number, stockQuantity: number }

// The option and size that a listing id belongs to, so a link to one choice opens the product with it chosen.
export function findChoiceById(options: ListingOption[] | undefined, listingId: number | null | undefined): { optionLabel: string, sizeLabel: string | null } | null {
    if (!options || listingId === null || listingId === undefined) {
        return null
    }

    for (const option of options) {
        if (option.listingId === listingId) {
            return { optionLabel: option.label, sizeLabel: null }
        }

        const size = option.sizes.find((candidate) => candidate.listingId === listingId)
        if (size) {
            return { optionLabel: option.label, sizeLabel: size.label }
        }
    }

    return null
}

// What the shopper can add to the cart, or null until they have chosen everything that is needed.
export function buyableChoice(option: ListingOption | null, size: ListingSize | null): BuyableChoice | null {
    if (option === null) {
        return null
    }

    if (option.sizes.length > 0) {
        return size ? { id: size.listingId, stockQuantity: size.stockQuantity } : null
    }

    return option.listingId === null ? null : { id: option.listingId, stockQuantity: option.stockQuantity ?? 0 }
}

// How many of an option are left across its sizes.
export function optionStock(option: ListingOption): number {
    return option.sizes.length > 0 ? option.sizes.reduce((total, size) => total + size.stockQuantity, 0) : option.stockQuantity ?? 0
}

export function hasOptions(listing: Pick<Listing, "hasOptions" | "options">): boolean {
    return listing.hasOptions === true && (listing.options?.length ?? 0) > 0
}
