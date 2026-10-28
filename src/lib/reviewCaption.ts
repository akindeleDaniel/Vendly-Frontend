import type { PublicReview } from "../types/review"

// The line over a review photo in the large viewer: "From Funke A.'s review · 5 stars".
export function reviewPhotoCaption(review: PublicReview): string {
    return `From ${review.reviewer}'s review · ${review.rating} ${review.rating === 1 ? "star" : "stars"}`
}
