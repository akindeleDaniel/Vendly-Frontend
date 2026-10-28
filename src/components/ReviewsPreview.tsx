import { useState } from "react"
import Notice from "./Notice"
import PhotoViewer from "./PhotoViewer"
import ReviewList, { PublicReviewCard, ReviewBars } from "./ReviewList"
import StarRating from "./StarRating"
import { fetchPublicReviews } from "../lib/reviewApi"
import { reviewPhotoCaption } from "../lib/reviewCaption"
import { useApiResource } from "../lib/useApiResource"
import type { PublicReview } from "../types/review"

const PREVIEW_COUNT = 3
const STRIP_COUNT = 5 // photos in the strip before "See all"

type OpenPhoto = { review: PublicReview, index: number }

type ReviewsPreviewProps = {
    kind: "product" | "shop"
    subject: string // the listing's id, or the shop's slug
    heading: string // for example "What buyers say"
    headingId: string // the section around it is labelled by this heading
}

type PhotoStripProps = {
    kind: "product" | "shop"
    subject: string
    reviewsWithPhotos: number
    onOpen: (photo: OpenPhoto) => void
    onSeeAll: () => void
}

// The newest buyer photos in a row, from the reviews that have them. Only drawn when there are some.
function BuyerPhotoStrip({ kind, subject, reviewsWithPhotos, onOpen, onSeeAll }: PhotoStripProps) {
    const { state } = useApiResource(`review-photos|${kind}|${subject}`, (signal) => fetchPublicReviews(kind, subject, 1, true, signal))

    if (state.kind !== "ready") {
        return null
    }

    const photos = state.data.reviews.flatMap((review) => (review.photoUrls ?? []).map((url, index) => ({ review, url, index })))

    if (photos.length === 0) {
        return null
    }

    return (
        <div className="review-strip" role="group" aria-labelledby={`${kind}-review-strip`}>
            <div className="review-strip-top">
                <b id={`${kind}-review-strip`}>Photos from buyers</b>
                <button type="button" className="btn-text" onClick={onSeeAll}>
                    See the {reviewsWithPhotos === 1 ? "review" : `${reviewsWithPhotos} reviews`} with photos
                </button>
            </div>
            <div className="review-strip-row">
                {photos.slice(0, STRIP_COUNT).map((photo, position) => (
                    <button
                        key={`${photo.review.id}-${photo.index}`}
                        type="button"
                        className={`review-strip-photo${position >= 3 ? " is-wide-only" : ""}`}
                        aria-label={`Open ${photo.review.reviewer}'s photo`}
                        onClick={() => onOpen({ review: photo.review, index: photo.index })}
                    >
                        <img src={photo.url} alt="" loading="lazy" />
                    </button>
                ))}
                <button type="button" className="review-strip-more" onClick={onSeeAll}>See<small>all</small></button>
            </div>
        </div>
    )
}

// Reviews on a shop or product page: the average, the buyers' photos and the three newest reviews,
// with buttons that open them all, or only the ones with photos.
function ReviewsPreview({ kind, subject, heading, headingId }: ReviewsPreviewProps) {
    const [showAll, setShowAll] = useState<null | "all" | "photos">(null)
    const [openPhoto, setOpenPhoto] = useState<OpenPhoto | null>(null)
    const { state, reload } = useApiResource(
        `reviews-preview|${kind}|${subject}`,
        (signal) => fetchPublicReviews(kind, subject, 1, false, signal)
    )

    if (showAll) {
        return <ReviewList kind={kind} subject={subject} initialWithPhotos={showAll === "photos"} />
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
    const withPhotos = summary.withPhotos ?? 0

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
                <ReviewBars summary={summary} />
                {summary.count > PREVIEW_COUNT && (
                    <button type="button" className="shop-btn is-plain review-read-all" onClick={() => setShowAll("all")}>
                        Read all {summary.count} reviews
                    </button>
                )}
            </div>
            <div className="review-preview-main">
                {withPhotos > 0 && (
                    <BuyerPhotoStrip kind={kind} subject={subject} reviewsWithPhotos={withPhotos} onOpen={setOpenPhoto} onSeeAll={() => setShowAll("photos")} />
                )}
                <ul className="public-review-list">
                    {reviews.slice(0, PREVIEW_COUNT).map((review) => (
                        <PublicReviewCard key={review.id} review={review} onOpenPhoto={(index) => setOpenPhoto({ review, index })} />
                    ))}
                </ul>
            </div>

            <PhotoViewer
                photos={openPhoto?.review.photoUrls ?? []}
                index={openPhoto?.index ?? null}
                caption={openPhoto ? reviewPhotoCaption(openPhoto.review) : ""}
                quote={openPhoto?.review.comment}
                onIndex={(index) => setOpenPhoto((open) => open && { ...open, index })}
                onClose={() => setOpenPhoto(null)}
            />
        </div>
    )
}

export default ReviewsPreview
