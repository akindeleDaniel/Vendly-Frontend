import { useState } from "react"
import { Camera, Check } from "lucide-react"
import Notice from "./Notice"
import Pagination from "./Pagination"
import PhotoViewer from "./PhotoViewer"
import ReviewPhotoThumbs from "./ReviewPhotoThumbs"
import StarRating from "./StarRating"
import { fetchPublicReviews } from "../lib/reviewApi"
import { formatShortDate } from "../lib/orderApi"
import { reviewPhotoCaption } from "../lib/reviewCaption"
import { useApiResource } from "../lib/useApiResource"
import type { PublicReview, ReviewSummary } from "../types/review"

type ReviewListProps = {
    kind: "product" | "shop"
    subject: string // the listing's id, or the shop's slug
    initialWithPhotos?: boolean // open on the reviews that have photos
}

type OpenPhoto = { review: PublicReview, index: number }

// How many gave each number of stars, as bars.
export function ReviewBars({ summary }: { summary: ReviewSummary }) {
    return (
        <ul className="review-bars-public" aria-label="Reviews by stars">
            {[5, 4, 3, 2, 1].map((stars) => {
                const count = summary.distribution[String(stars)] ?? 0
                const percent = summary.count > 0 ? Math.round(count / summary.count * 100) : 0
                return (
                    <li key={stars}>
                        <span>{stars} {stars === 1 ? "star" : "stars"}</span>
                        <span className="review-bar-track" aria-hidden="true"><i style={{ width: `${percent}%` }} /></span>
                        <b>{count}</b>
                    </li>
                )
            })}
        </ul>
    )
}

// One public review: stars, words, photos and who wrote it.
export function PublicReviewCard({ review, onOpenPhoto }: { review: PublicReview, onOpenPhoto: (index: number) => void }) {
    return (
        <li className="public-review">
            <div className="public-review-top">
                <StarRating average={review.rating} count={1} showCount={false} />
                <span className="shop-verified"><Check aria-hidden="true" size={16} />Verified buyer</span>
            </div>
            {review.comment && <p>{review.comment}</p>}
            <ReviewPhotoThumbs urls={review.photoUrls ?? []} who={`${review.reviewer}'s`} onOpen={onOpenPhoto} />
            <p className="public-review-who">
                <span className="public-review-avatar" aria-hidden="true">{review.reviewer.charAt(0).toUpperCase()}</span>
                <span><b>{review.reviewer}</b>{formatShortDate(review.createdAt)}{review.edited ? " · edited" : ""}</span>
            </p>
        </li>
    )
}

// What shoppers have said about a product or a shop: the average, how many gave each rating, and the
// reviews themselves, ten to a page. "With photos" lists only the reviews that have photos.
function ReviewList({ kind, subject, initialWithPhotos = false }: ReviewListProps) {
    const [page, setPage] = useState(1)
    const [withPhotos, setWithPhotos] = useState(initialWithPhotos)
    const [openPhoto, setOpenPhoto] = useState<OpenPhoto | null>(null)
    const { state, reload } = useApiResource(
        `${kind}|${subject}|${page}|${withPhotos}`,
        (signal) => fetchPublicReviews(kind, subject, page, withPhotos, signal)
    )

    function show(photosOnly: boolean) {
        setWithPhotos(photosOnly)
        setPage(1)
    }

    const summary = state.kind === "ready" ? state.data.summary : null
    const photoCount = summary?.withPhotos ?? 0
    // With the filter on, the pages count only the reviews with photos.
    const listed = withPhotos ? photoCount : summary?.count ?? 0

    return (
        <section aria-labelledby="reviews-heading" className="public-reviews">
            {state.kind === "loading" && <p role="status">Loading reviews...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && summary && (
                summary.count === 0 ? <><h2 id="reviews-heading">Reviews</h2><p>No reviews yet.</p></> : (
                    <div className="public-reviews-layout">
                        <div className="public-reviews-side">
                            <p className="shop-reviews-average">{summary.average?.toFixed(1)}</p>
                            <StarRating average={summary.average} count={summary.count} showCount={false} />
                            <p className="shop-reviews-note">
                                From {summary.count} {summary.count === 1 ? "buyer" : "buyers"}{photoCount > 0 ? `, ${photoCount} with photos` : ""}.
                            </p>
                            <ReviewBars summary={summary} />
                        </div>
                        <div className="public-reviews-main">
                            <div className="public-reviews-head">
                                <h2 id="reviews-heading">Reviews</h2>
                                {photoCount > 0 && (
                                    <div className="orders-filters public-review-filters" role="group" aria-label="Show">
                                        <button type="button" className={`orders-filter${withPhotos ? "" : " is-active"}`} aria-pressed={!withPhotos} onClick={() => show(false)}>
                                            All<span className="orders-filter-count">{summary.count}</span>
                                        </button>
                                        <button type="button" className={`orders-filter${withPhotos ? " is-active" : ""}`} aria-pressed={withPhotos} onClick={() => show(true)}>
                                            <Camera size={16} aria-hidden="true" />With photos<span className="orders-filter-count">{photoCount}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <ul className="public-review-list">
                                {state.data.reviews.map((review) => (
                                    <PublicReviewCard key={review.id} review={review} onOpenPhoto={(index) => setOpenPhoto({ review, index })} />
                                ))}
                            </ul>
                            <Pagination page={page} pageSize={state.data.pageSize} total={listed} onChange={setPage} />
                        </div>
                    </div>
                )
            )}

            <PhotoViewer
                photos={openPhoto?.review.photoUrls ?? []}
                index={openPhoto?.index ?? null}
                caption={openPhoto ? reviewPhotoCaption(openPhoto.review) : ""}
                quote={openPhoto?.review.comment}
                onIndex={(index) => setOpenPhoto((open) => open && { ...open, index })}
                onClose={() => setOpenPhoto(null)}
            />
        </section>
    )
}

export default ReviewList
