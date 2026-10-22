import { useState } from "react"
import Notice from "./Notice"
import Pagination from "./Pagination"
import StarRating from "./StarRating"
import { fetchListingReviews, fetchShopReviews } from "../lib/reviewApi"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"

type ReviewListProps = {
    kind: "product" | "shop"
    subject: string // the listing's id, or the shop's slug
}

// What shoppers have said about a product or a shop: the average, how many gave each rating, and the
// reviews themselves, ten to a page.
function ReviewList({ kind, subject }: ReviewListProps) {
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(
        `${kind}|${subject}|${page}`,
        (signal) => kind === "product" ? fetchListingReviews(subject, page, signal) : fetchShopReviews(subject, page, signal)
    )

    return (
        <section aria-labelledby="reviews-heading" className="card summary-card review-section">
            <h2 id="reviews-heading">Reviews</h2>
            {state.kind === "loading" && <p role="status">Loading reviews...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                state.data.summary.count === 0 ? <p>No reviews yet.</p> : (
                    <>
                        <div className="review-summary">
                            <StarRating average={state.data.summary.average} count={state.data.summary.count} />
                            <dl className="review-distribution">
                                {[5, 4, 3, 2, 1].map((rating) => (
                                    <div key={rating}><dt>{rating} {rating === 1 ? "star" : "stars"}</dt><dd>{state.data.summary.distribution[String(rating)] ?? 0}</dd></div>
                                ))}
                            </dl>
                        </div>
                        <ul className="review-list">
                            {state.data.reviews.map((review) => (
                                <li key={review.id} className="review-item">
                                    <StarRating average={review.rating} count={1} showCount={false} />
                                    {review.comment && <p>{review.comment}</p>}
                                    <p className="review-meta">
                                        {review.reviewer} · {formatShortDate(review.createdAt)}{review.edited ? " · edited" : ""}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        <Pagination page={page} pageSize={state.data.pageSize} total={state.data.summary.count} onChange={setPage} />
                    </>
                )
            )}
        </section>
    )
}

export default ReviewList
