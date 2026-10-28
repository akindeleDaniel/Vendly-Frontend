import { useId, useState } from "react"
import { Link } from "react-router-dom"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import Stars from "../components/ReviewStars"
import { failureMessage } from "../lib/apiRequest"
import { formatOrderDay } from "../lib/buyerOrders"
import { fetchMyReviews, reportReview } from "../lib/reviewApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { SellerReview, SellerReviewPage, SellerReviewType } from "../types/review"

const REASON_MIN = 3
const REASON_MAX = 300

const TABS: Array<{ type: SellerReviewType, label: string }> = [
    { type: "shop", label: "Your shop" },
    { type: "product", label: "Your products" }
]

// The average, the stars and how many reviews gave each number of stars, over the reviews shoppers see.
function ReviewSummaryCard({ type, summary }: { type: SellerReviewType, summary: NonNullable<SellerReviewPage["summary"]> }) {
    return (
        <section className="money-card review-summary" aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="money-side-title">{type === "shop" ? "Your shop rating" : "Across your products"}</h2>
            {summary.average === null || summary.count === 0 ? (
                <p className="product-help">No reviews that shoppers can see yet.</p>
            ) : (
                <>
                    <div className="review-score">
                        <b>{summary.average.toFixed(1)}</b>
                        <Stars rating={summary.average} size={20} />
                        <span>From {summary.count === 1 ? "1 review" : `${summary.count} reviews`}</span>
                    </div>
                    <ul className="review-bars" aria-label="Reviews by stars">
                        {[5, 4, 3, 2, 1].map((stars) => {
                            const count = summary.distribution[String(stars)] ?? 0
                            return (
                                <li key={stars}>
                                    <span>{stars} ★<span className="visually-hidden">: {count} {count === 1 ? "review" : "reviews"}</span></span>
                                    <span className="review-track" aria-hidden="true"><i style={{ width: `${Math.round((count / summary.count) * 100)}%` }} /></span>
                                    <span aria-hidden="true">{count}</span>
                                </li>
                            )
                        })}
                    </ul>
                </>
            )}
            <p className="product-help">Hidden reviews don't count, so this matches what shoppers see.</p>
        </section>
    )
}

type ReportFormProps = {
    type: SellerReviewType
    review: SellerReview
    onReported: () => void
    onCancel: () => void
}

function ReportForm({ type, review, onReported, onCancel }: ReportFormProps) {
    const reasonId = useId()
    const [reason, setReason] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSending) {
            return
        }

        const trimmed = reason.trim()
        if (trimmed.length < REASON_MIN) {
            setError(`Tell us why in at least ${REASON_MIN} characters.`)
            return
        }

        setIsSending(true)
        setError("")
        const result = await reportReview(type, review.id, trimmed)
        setIsSending(false)

        if (result.kind === "ok") {
            onReported()
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <form onSubmit={handleSubmit} className="review-report">
            <div className="product-field-top">
                <label htmlFor={reasonId}>Why should StoreHatch look at this review?</label>
                <small>{reason.length} / {REASON_MAX}</small>
            </div>
            <textarea
                id={reasonId}
                className="product-input product-textarea review-report-text"
                maxLength={REASON_MAX}
                placeholder="For example: this buyer never ordered this product"
                value={reason}
                disabled={isSending}
                onChange={(event) => setReason(event.target.value)}
            />
            {error && <Notice kind="error">{error}</Notice>}
            <div className="review-report-actions">
                <button type="submit" className="btn btn-primary" disabled={isSending}>{isSending ? "Sending..." : "Send report"}</button>
                <button type="button" className="btn" onClick={onCancel} disabled={isSending}>Cancel</button>
            </div>
        </form>
    )
}

function ReviewCard({ type, review, onReported }: { type: SellerReviewType, review: SellerReview, onReported: () => void }) {
    const [isReporting, setIsReporting] = useState(false)
    const photos = review.photoUrls ?? []

    return (
        <li className={`review-card${review.hidden ? " is-hidden" : ""}`}>
            <div className="review-card-head">
                <span className="review-avatar" aria-hidden="true">{review.reviewer.charAt(0).toUpperCase()}</span>
                <div className="review-who">
                    <b>{review.reviewer}</b>
                    <span>{formatOrderDay(review.createdAt, { year: true })}</span>
                </div>
                <div className="review-card-tags">
                    <Stars rating={review.rating} />
                    {review.reported && <span className="review-pill is-reported">Reported</span>}
                    {review.hidden && <span className="review-pill is-hidden">Hidden</span>}
                </div>
            </div>
            {review.listing && <Link to={`/product/${review.listing.id}`} className="review-product">{review.listing.title}</Link>}
            {review.comment ? <p className="review-comment">{review.comment}</p> : <p className="product-help">Stars only, no comment.</p>}
            {photos.length > 0 && (
                <div className="review-photos">
                    {photos.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="Photo from the buyer" loading="lazy" />
                            <span className="visually-hidden"> (opens in a new tab)</span>
                        </a>
                    ))}
                </div>
            )}
            {review.hidden && <p className="product-help">StoreHatch hid this review, so shoppers don't see it and it doesn't count in your rating.</p>}
            {review.reported && !review.hidden && <p className="product-help">You reported this review. StoreHatch will look at it.</p>}
            {!review.reported && !review.hidden && (isReporting
                ? <ReportForm type={type} review={review} onReported={onReported} onCancel={() => setIsReporting(false)} />
                : <button type="button" className="btn-text review-report-open" onClick={() => setIsReporting(true)}>Report this review</button>)}
        </li>
    )
}

// The reviews of the seller's own shop and products, including ones that were reported or hidden, with
// the rating shoppers see. A seller cannot reply, but can report a review for an administrator to look at.
function SellerReviewsPage() {
    useDocumentTitle("Reviews")
    const [type, setType] = useState<SellerReviewType>("shop")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(`${type}|${page}`, (signal) => fetchMyReviews(type, page, signal))
    const counts = state.kind === "ready" ? state.data.counts : undefined

    return (
        <div className="money-page">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="product-form-title">
                <h1>Reviews</h1>
                <p>What buyers say about your shop and your products. If a review breaks the rules, report it and StoreHatch will look at it.</p>
            </div>

            <div className="money-chips" role="group" aria-label="Show reviews of">
                {TABS.map((tab) => (
                    <button key={tab.type} type="button" className={`money-chip${type === tab.type ? " is-on" : ""}`} aria-pressed={type === tab.type} onClick={() => { setType(tab.type); setPage(1) }}>
                        {tab.label}
                        {counts && <span className="money-chip-count">{counts[tab.type]}</span>}
                    </button>
                ))}
            </div>

            {state.kind === "loading" && <p role="status">Loading reviews...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <div className="review-layout">
                    {state.data.summary && <ReviewSummaryCard type={type} summary={state.data.summary} />}
                    <div className="review-list-column">
                        {state.data.reviews.length === 0 ? (
                            <div className="money-empty">
                                <b>No reviews yet</b>
                                {type === "shop" ? "Buyers can review your shop after an order is delivered." : "Buyers can review a product after their order is delivered."}
                            </div>
                        ) : (
                            <>
                                <ul className="review-list">
                                    {state.data.reviews.map((review) => <ReviewCard key={review.id} type={type} review={review} onReported={reload} />)}
                                </ul>
                                <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default SellerReviewsPage
