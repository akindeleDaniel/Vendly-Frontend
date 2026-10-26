import { useState } from "react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import StarRating from "../components/StarRating"
import { failureMessage } from "../lib/apiRequest"
import { formatShortDate } from "../lib/orderApi"
import { fetchMyReviews, reportReview } from "../lib/reviewApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { SellerReview, SellerReviewType } from "../types/review"

const REASON_MIN = 3
const REASON_MAX = 300

type ReportFormProps = {
    type: SellerReviewType
    review: SellerReview
    onReported: () => void
}

function ReportForm({ type, review, onReported }: ReportFormProps) {
    const [isOpen, setIsOpen] = useState(false)
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
            setIsOpen(false)
            onReported()
        } else {
            setError(failureMessage(result))
        }
    }

    if (!isOpen) {
        return <button type="button" onClick={() => setIsOpen(true)}>Report this review</button>
    }

    return (
        <form onSubmit={handleSubmit} className="stack-form">
            <label>
                Why should StoreHatch look at this review?
                <textarea maxLength={REASON_MAX} value={reason} disabled={isSending} onChange={(event) => setReason(event.target.value)} />
            </label>
            {error && <Notice kind="error">{error}</Notice>}
            <div className="action-row">
                <button type="submit" className="btn btn-primary" disabled={isSending}>{isSending ? "Sending..." : "Send report"}</button>
                <button type="button" onClick={() => setIsOpen(false)} disabled={isSending}>Cancel</button>
            </div>
        </form>
    )
}

// The reviews of the seller's own shop and products, including ones that were reported or hidden.
// A seller cannot reply, but can report a review for an administrator to look at.
function SellerReviewsPage() {
    useDocumentTitle("Your reviews")
    const [type, setType] = useState<SellerReviewType>("shop")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(`${type}|${page}`, (signal) => fetchMyReviews(type, page, signal))

    return (
        <div>
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <h1>Your reviews</h1>

            <div className="filter-row">
                <label className="field-inline">
                    Show reviews of{" "}
                    <select value={type} onChange={(event) => { setType(event.target.value as SellerReviewType); setPage(1) }}>
                        <option value="shop">Your shop</option>
                        <option value="product">Your products</option>
                    </select>
                </label>
            </div>

            {state.kind === "loading" && <p role="status">Loading reviews...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                state.data.reviews.length === 0 ? <p>No reviews yet.</p> : (
                    <>
                        <ul className="order-history">
                            {state.data.reviews.map((review) => (
                                <li key={review.id} className="card order-card">
                                    <div className="order-header">
                                        <StarRating average={review.rating} count={1} showCount={false} />
                                        <span className="badge-group">
                                            {review.reported && <span className="badge badge-amber">Reported</span>}
                                            {review.hidden && <span className="badge">Hidden</span>}
                                        </span>
                                    </div>
                                    {review.listing && <p className="order-line-meta">{review.listing.title}</p>}
                                    {review.comment ? <p>{review.comment}</p> : <p className="field-help">No comment.</p>}
                                    <p className="review-meta">{review.reviewer} · {formatShortDate(review.createdAt)}</p>
                                    {review.reported
                                        ? <p className="field-help">You reported this review. StoreHatch will look at it.</p>
                                        : <ReportForm type={type} review={review} onReported={reload} />}
                                </li>
                            ))}
                        </ul>
                        <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                    </>
                )
            )}
        </div>
    )
}

export default SellerReviewsPage
