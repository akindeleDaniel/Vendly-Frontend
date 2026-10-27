import { useState } from "react"
import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import StarRating from "../components/StarRating"
import { failureMessage } from "../lib/apiRequest"
import { formatShortDate } from "../lib/orderApi"
import { listAdminReviews, setReviewHidden } from "../lib/reviewApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminReview, AdminReviewStatus, SellerReviewType } from "../types/review"
import BackArrow from "../components/BackArrow"

const STATUS_FILTERS: Array<{ value: AdminReviewStatus, label: string }> = [
    { value: "reported", label: "Reported" },
    { value: "hidden", label: "Hidden" },
    { value: "visible", label: "Visible" },
    { value: "all", label: "All" }
]

const REASON_MIN = 3
const REASON_MAX = 300

function ReviewActions({ review, onChanged }: { review: AdminReview, onChanged: () => void }) {
    const [isHiding, setIsHiding] = useState(false)
    const [reason, setReason] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const isHidden = review.hiddenAt !== null

    async function run(hide: boolean) {
        if (isWorking) {
            return
        }

        if (hide && reason.trim().length < REASON_MIN) {
            setError(`Give a reason of at least ${REASON_MIN} characters.`)
            return
        }

        setIsWorking(true)
        setError("")
        const result = await setReviewHidden(review.type, review.id, hide, reason.trim())
        setIsWorking(false)

        if (result.kind === "ok") {
            setIsHiding(false)
            setReason("")
            onChanged()
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <div className="stack-form">
            {isHidden && (
                <button type="button" onClick={() => run(false)} disabled={isWorking}>{isWorking ? "Working..." : "Show this review again"}</button>
            )}
            {!isHidden && !isHiding && <button type="button" onClick={() => setIsHiding(true)}>Hide this review</button>}
            {!isHidden && isHiding && (
                <>
                    <label>
                        Why is it being hidden?
                        <textarea maxLength={REASON_MAX} value={reason} disabled={isWorking} onChange={(event) => setReason(event.target.value)} />
                    </label>
                    <div className="action-row">
                        <button type="button" className="btn btn-primary" onClick={() => run(true)} disabled={isWorking}>{isWorking ? "Hiding..." : "Hide"}</button>
                        <button type="button" onClick={() => setIsHiding(false)} disabled={isWorking}>Cancel</button>
                    </div>
                </>
            )}
            {error && <Notice kind="error">{error}</Notice>}
        </div>
    )
}

// Reviews for an administrator to look at: the ones sellers reported first. Hiding a review takes it
// off the public pages and out of the average; showing it puts it back.
function AdminReviewsPage() {
    useDocumentTitle("Reviews")
    const [type, setType] = useState<SellerReviewType>("product")
    const [status, setStatus] = useState<AdminReviewStatus>("reported")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(`${type}|${status}|${page}`, (signal) => listAdminReviews(type, status, page, signal))

    return (
        <div>
            <BackArrow to="/admin" label="Back to the admin dashboard" />
            <h1>Reviews</h1>

            <div className="filter-row">
                <label className="field-inline">
                    Reviews of{" "}
                    <select value={type} onChange={(event) => { setType(event.target.value as SellerReviewType); setPage(1) }}>
                        <option value="product">Products</option>
                        <option value="shop">Shops</option>
                    </select>
                </label>
                <label className="field-inline">
                    Show{" "}
                    <select value={status} onChange={(event) => { setStatus(event.target.value as AdminReviewStatus); setPage(1) }}>
                        {STATUS_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
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
                <>
                    <p className="field-help">{state.data.total} {state.data.total === 1 ? "review" : "reviews"} found.</p>
                    {state.data.reviews.length === 0 ? <p>No reviews match.</p> : (
                        <ul className="order-history">
                            {state.data.reviews.map((review) => (
                                <li key={`${review.type}-${review.id}`} className="card order-card">
                                    <div className="order-header">
                                        <StarRating average={review.rating} count={1} showCount={false} />
                                        <span className="badge-group">
                                            {review.reportedAt && <span className="badge badge-amber">Reported</span>}
                                            {review.hiddenAt && <span className="badge">Hidden</span>}
                                        </span>
                                    </div>
                                    <p className="order-line-meta">
                                        {review.type === "shop" ? review.subject.businessName : review.subject.title} · {formatShortDate(review.createdAt)}
                                    </p>
                                    {review.comment ? <p>{review.comment}</p> : <p className="field-help">No comment.</p>}
                                    <dl className="detail-list">
                                        <div><dt>Written by</dt><dd><Link to={`/admin/users/${review.buyer.id}`}>{review.buyer.name}</Link>, {review.buyer.email}</dd></div>
                                        <div><dt>Order</dt><dd><Link to={`/admin/orders/${review.orderId}`}>Order {review.orderId}</Link></dd></div>
                                        {review.reportReason && <div><dt>Reported because</dt><dd>{review.reportReason}</dd></div>}
                                        {review.hiddenReason && <div><dt>Hidden because</dt><dd>{review.hiddenReason}</dd></div>}
                                    </dl>
                                    <ReviewActions review={review} onChanged={reload} />
                                </li>
                            ))}
                        </ul>
                    )}
                    <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}
        </div>
    )
}

export default AdminReviewsPage
