import { Star } from "lucide-react"

// Five stars, filled to the rating, read out as "4 out of 5 stars".
function ReviewStars({ rating, size = 16 }: { rating: number, size?: number }) {
    const filled = Math.round(rating)

    return (
        <span className="review-stars" role="img" aria-label={`${rating.toFixed(rating % 1 === 0 ? 0 : 1)} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={size} aria-hidden="true" className={star <= filled ? "is-on" : undefined} fill="currentColor" strokeWidth={0} />
            ))}
        </span>
    )
}

export default ReviewStars
