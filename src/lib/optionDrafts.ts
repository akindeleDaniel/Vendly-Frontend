import type { Listing } from "../types/listing"
import { PRICE_MAX, STOCK_MAX } from "./limits"
import { uploadImage } from "./uploadImage"

// The backend's limits on a product's options.
export const MAX_OPTIONS = 20
export const MAX_SIZES_PER_OPTION = 20
export const MAX_CHOICES = 100
export const OPTION_LABEL_MAX_LENGTH = 40

export type SizeDraft = { id: string, label: string, stock: string }

// One option (for example a colour) while the seller is filling it in. Everything is text until it is sent.
export type OptionDraft = {
    id: string
    label: string
    price: string // empty means the product's own price
    photoUrl: string | null // a photo that is already saved
    photoFile: File | null // a photo just chosen, to be uploaded on save
    hasSizes: boolean
    stock: string // used when the option has no sizes
    sizes: SizeDraft[]
}

let counter = 0

export function newId(): string {
    counter += 1
    return `draft-${Date.now()}-${counter}`
}

export function newSizeDraft(): SizeDraft {
    return { id: newId(), label: "", stock: "" }
}

export function newOptionDraft(): OptionDraft {
    return { id: newId(), label: "", price: "", photoUrl: null, photoFile: null, hasSizes: false, stock: "", sizes: [] }
}

// The saved options of a listing as drafts to edit. An option photo that is only the product's own first
// photo (what the backend shows when an option has none) is treated as no photo.
export function draftsFromListing(listing: Pick<Listing, "options" | "imageUrl">): OptionDraft[] {
    return (listing.options ?? []).map((option) => ({
        id: newId(),
        label: option.label,
        price: String(option.price),
        photoUrl: option.imageUrl && option.imageUrl !== listing.imageUrl ? option.imageUrl : null,
        photoFile: null,
        hasSizes: option.sizes.length > 0,
        stock: option.sizes.length > 0 ? "" : String(option.stockQuantity ?? 0),
        sizes: option.sizes.map((size) => ({ id: newId(), label: size.label, stock: String(size.stockQuantity) }))
    }))
}

function stockProblem(value: string, what: string): string | null {
    const stock = Number(value)

    if (value.trim() === "" || !Number.isInteger(stock) || stock < 0) {
        return `${what}: stock must be a whole number, 0 or more`
    }

    return stock > STOCK_MAX ? `${what}: stock must be ${STOCK_MAX.toLocaleString("en-NG")} or fewer` : null
}

// What is wrong with the options, or null when they can be sent.
export function validateOptionDrafts(drafts: OptionDraft[]): string | null {
    if (drafts.length === 0) {
        return "Add at least one option, or turn options off."
    }

    if (drafts.length > MAX_OPTIONS) {
        return `A product can have at most ${MAX_OPTIONS} options.`
    }

    const seen = new Set<string>()
    let choices = 0

    for (const draft of drafts) {
        const label = draft.label.trim().replace(/\s+/g, " ")

        if (label === "") {
            return "Give every option a name."
        }

        if (label.length > OPTION_LABEL_MAX_LENGTH) {
            return `An option name must be ${OPTION_LABEL_MAX_LENGTH} characters or fewer.`
        }

        if (seen.has(label.toLowerCase())) {
            return `The option "${label}" is listed twice.`
        }
        seen.add(label.toLowerCase())

        const price = draft.price.trim()
        if (price !== "" && (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0 || Number(price) > PRICE_MAX)) {
            return `Option "${label}": the price must be more than 0, with at most two decimal places.`
        }

        if (!draft.hasSizes) {
            const problem = stockProblem(draft.stock, `Option "${label}"`)
            if (problem) {
                return problem
            }
            choices += 1
            continue
        }

        if (draft.sizes.length === 0) {
            return `Option "${label}" comes in sizes, so add at least one size.`
        }

        if (draft.sizes.length > MAX_SIZES_PER_OPTION) {
            return `Option "${label}" can have at most ${MAX_SIZES_PER_OPTION} sizes.`
        }

        const seenSizes = new Set<string>()
        for (const size of draft.sizes) {
            const sizeLabel = size.label.trim().replace(/\s+/g, " ")

            if (sizeLabel === "") {
                return `Option "${label}": give every size a name.`
            }

            if (sizeLabel.length > OPTION_LABEL_MAX_LENGTH) {
                return `Option "${label}": a size name must be ${OPTION_LABEL_MAX_LENGTH} characters or fewer.`
            }

            if (seenSizes.has(sizeLabel.toLowerCase())) {
                return `Option "${label}": the size "${sizeLabel}" is listed twice.`
            }
            seenSizes.add(sizeLabel.toLowerCase())

            const problem = stockProblem(size.stock, `Option "${label}", size "${sizeLabel}"`)
            if (problem) {
                return problem
            }
        }

        choices += draft.sizes.length
    }

    return choices > MAX_CHOICES ? `A product can have at most ${MAX_CHOICES} things to choose between in total (sizes count separately).` : null
}

// The options as the backend wants them, with any new photos uploaded first. Null when a photo upload fails.
export async function buildOptionsBody(drafts: OptionDraft[]) {
    const options = []

    for (const draft of drafts) {
        let imageUrl = draft.photoUrl

        if (draft.photoFile !== null) {
            imageUrl = await uploadImage(draft.photoFile)
            if (imageUrl === null) {
                return null
            }
        }

        const price = draft.price.trim()
        options.push({
            label: draft.label.trim().replace(/\s+/g, " "),
            ...(price ? { price: Number(price) } : {}),
            ...(imageUrl ? { imageUrl } : {}),
            ...(draft.hasSizes
                ? { sizes: draft.sizes.map((size) => ({ label: size.label.trim().replace(/\s+/g, " "), stockQuantity: Number(size.stock) })) }
                : { stockQuantity: Number(draft.stock) })
        })
    }

    return options
}
