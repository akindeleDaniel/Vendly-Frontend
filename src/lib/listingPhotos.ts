import type { Listing } from "../types/listing"
import { uploadImage } from "./uploadImage"

export const MAX_LISTING_PHOTOS = 5

// One photo in a listing's list. A photo that is already saved has only a `url`; one the seller has just
// chosen has the cropped `file` too, and its `url` is a temporary preview address.
export type ListingPhoto = {
    id: string
    url: string
    file: File | null
}

// The photos of a listing in the order shoppers see them. Listings from before several photos existed
// only have `imageUrl`.
export function photosOf(listing: Pick<Listing, "images" | "imageUrl">): string[] {
    if (listing.images && listing.images.length > 0) {
        return listing.images
    }

    return listing.imageUrl ? [listing.imageUrl] : []
}

export function savedPhotos(listing: Pick<Listing, "images" | "imageUrl">): ListingPhoto[] {
    return photosOf(listing).map((url, index) => ({ id: `saved-${index}-${url}`, url, file: null }))
}

// True when the seller added, removed or reordered a photo.
export function photosChanged(listing: Pick<Listing, "images" | "imageUrl">, photos: ListingPhoto[]): boolean {
    const before = photosOf(listing)
    return photos.length !== before.length || photos.some((photo, index) => photo.file !== null || photo.url !== before[index])
}

// Uploads the new photos and returns every photo's address, in order. Null when an upload fails.
export async function uploadListingPhotos(photos: ListingPhoto[]): Promise<string[] | null> {
    const urls: string[] = []

    for (const photo of photos) {
        if (photo.file === null) {
            urls.push(photo.url)
            continue
        }

        const uploaded = await uploadImage(photo.file)
        if (uploaded === null) {
            return null
        }
        urls.push(uploaded)
    }

    return urls
}
