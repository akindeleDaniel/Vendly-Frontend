import { useState } from "react"
import { Check } from "lucide-react"
import Notice from "./Notice"
import ReviewList from "./ReviewList"
import StarRating from "./StarRating"
import { fetchListingReviews, fetchShopReviews } from "../lib/reviewApi"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"

const PREVIEW_COUNT = 3

type ReviewsPreviewProps = {
    kind: "product" | "shop"
    subject: string // the listing's id, or the shop's slug
    heading: string // for example "What buyers say"
    headingId: string // the section around it is labelled by this heading
}

// Reviews on a shop or product page: the average and the three newest reviews, with a button that
// opens them all.
function ReviewsPreview({ kind, subject, heading, headingId }: ReviewsPreviewProps) {
    const [showAll, setShowAll] = useState(false)
    const { state, reload } = useApiResource(
        `reviews-preview|${kind}|${subject}`,
        (signal) => kind === "product" ? fetchListingReviews(subject, 1, signal) : fetchShopReviews(subject, 1, signal)
    )

    if (showAll) {
        return <ReviewList kind={kind} subject={subject} />
    }

    if (state.kind === "loading") {
        return <p role="status">Loading reviews...</p>
    }

    if (state.kind === "error") {
        return (
            <Notice kind="error">
                <p>{state.message}</p>
                <button type="button" onClick={reload}>Try again</button>
            </Notice>
        )
    }

    const { summary, reviews } = state.data

    if (summary.count === 0) {
        return (
            <div className="shop-panel shop-reviews-empty">
                <h2 id={headingId}>No reviews yet</h2>
                <p>Buyers can leave a review once their order is delivered, so the first ones will show here.</p>
            </div>
        )
    }

    return (
        <div className="shop-reviews">
            <div>
                <h2 id={headingId} className="shop-heading">{heading}</h2>
                <p className="shop-reviews-average">{summary.average?.toFixed(1)}</p>
                <StarRating average={summary.average} count={summary.count} showCount={false} />
                <p className="shop-reviews-note">
                    From {summary.count} {summary.count === 1 ? "buyer" : "buyers"}. Only buyers whose order was delivered can leave a review.
                </p>
                {summary.count > PREVIEW_COUNT && (
                    <button type="button" className="shop-btn is-plain" onClick={() => setShowAll(true)}>
                        Read all {summary.count} reviews
                    </button>
                )}
            </div>
            <ul className="shop-review-cards">
                {reviews.slice(0, PREVIEW_COUNT).map((review) => (
                    <li key={review.id} className="shop-review-card">
                        <StarRating average={review.rating} count={1} showCount={false} />
                        {review.comment && <p>{review.comment}</p>}
                        <p className="shop-review-meta">
                            <b>{review.reviewer}</b>
                            <span>{formatShortDate(review.createdAt)}{review.edited ? " · edited" : ""}</span>
                        </p>
                        <span className="shop-verified"><Check aria-hidden="true" size={16} />Verified buyer</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default ReviewsPreview
