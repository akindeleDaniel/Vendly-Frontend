import { useState } from "react"
import Notice from "./Notice"
import StarInput from "./StarInput"
import StarRating from "./StarRating"
import { changeReview, createOrderReview, fetchOrderReviews, removeReview } from "../lib/reviewApi"
import type { ReviewKind } from "../lib/reviewApi"
import { failureMessage } from "../lib/apiRequest"
import type { ApiResult } from "../lib/apiRequest"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { REVIEW_COMMENT_MAX_LENGTH } from "../types/review"
import type { MyReview } from "../types/review"

type ReviewTargetProps = {
    heading: string
    kind: ReviewKind
    review: MyReview | null
    // Writes a new review. Resolves to the result so the editor can show a problem.
    onCreate: (rating: number, comment: string) => Promise<ApiResult<unknown>>
    onChanged: () => void
}

// One thing that can be reviewed: the shop, or a product in the order. Shows the buyer's review when they
// have written one (with Edit and Delete for the first 7 days) and the form when they have not.
function ReviewTarget({ heading, kind, review, onCreate, onChanged }: ReviewTargetProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [rating, setRating] = useState(review?.rating ?? 0)
    const [comment, setComment] = useState(review?.comment ?? "")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isWorking) {
            return
        }

        if (rating < 1) {
            setError("Choose how many stars to give.")
            return
        }

        setIsWorking(true)
        setError("")
        const trimmed = comment.trim()
        const result = review === null
            ? await onCreate(rating, trimmed)
            : await changeReview(kind, review.id, { rating, comment: trimmed === "" ? null : trimmed })
        setIsWorking(false)

        if (result.kind === "ok") {
            setIsEditing(false)
            onChanged()
        } else {
            setError(failureMessage(result))
        }
    }

    async function handleDelete() {
        if (isWorking || review === null || !window.confirm("Delete this review?")) {
            return
        }

        setIsWorking(true)
        setError("")
        const result = await removeReview(kind, review.id)
        setIsWorking(false)

        if (result.kind === "ok") {
            onChanged()
        } else {
            setError(failureMessage(result))
        }
    }

    if (review !== null && !isEditing) {
        return (
            <div className="review-target">
                <h3>{heading}</h3>
                <StarRating average={review.rating} count={1} showCount={false} />
                {review.comment && <p>{review.comment}</p>}
                <p className="review-meta">Written {formatShortDate(review.createdAt)}</p>
                {review.hidden && <Notice kind="warning">StoreHatch has hidden this review from the public.</Notice>}
                {error && <Notice kind="error">{error}</Notice>}
                {review.canChange
                    ? (
                        <div className="action-row">
                            <button type="button" onClick={() => setIsEditing(true)} disabled={isWorking}>Edit</button>
                            <button type="button" className="btn-text" onClick={handleDelete} disabled={isWorking}>Delete</button>
                        </div>
                    )
                    : <p className="field-help">A review can be changed for 7 days after it is written.</p>}
            </div>
        )
    }

    return (
        <form className="review-target stack-form" onSubmit={handleSubmit}>
            <h3>{heading}</h3>
            <StarInput label="Your rating" value={rating} onChange={setRating} disabled={isWorking} />
            <label>
                Comment (optional)
                <textarea
                    maxLength={REVIEW_COMMENT_MAX_LENGTH}
                    value={comment}
                    disabled={isWorking}
                    onChange={(event) => setComment(event.target.value)}
                />
            </label>
            {error && <Notice kind="error">{error}</Notice>}
            <div className="action-row">
                <button type="submit" className="btn btn-primary" disabled={isWorking}>
                    {isWorking ? "Saving..." : review === null ? "Post review" : "Save changes"}
                </button>
                {review !== null && <button type="button" onClick={() => { setIsEditing(false); setRating(review.rating); setComment(review.comment ?? "") }} disabled={isWorking}>Cancel</button>}
            </div>
        </form>
    )
}

type OrderReviewsPanelProps = {
    checkoutId: number
    sellerOrderId: number
    startOpen?: boolean// true when the buyer came here from a "Write a review" button
}

// After an order is delivered the buyer can rate the shop and each product in it. A review can be
// changed or deleted for 7 days.
function OrderReviewsPanel({ checkoutId, sellerOrderId, startOpen = false }: OrderReviewsPanelProps) {
    const [isOpen, setIsOpen] = useState(startOpen)
    const { state, reload } = useApiResource(`${checkoutId}|${sellerOrderId}`, (signal) => fetchOrderReviews(checkoutId, sellerOrderId, signal))

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

    if (!state.data.canReview) {
        return null
    }

    const hasReviewed = state.data.shop !== null || state.data.products.some((product) => product.review !== null)

    if (!isOpen) {
        return (
            <div className="review-panel">
                <button type="button" className="btn btn-primary" onClick={() => setIsOpen(true)}>
                    {hasReviewed ? "See or change your reviews" : "Write a review"}
                </button>
            </div>
        )
    }

    // The key restarts a form with the saved values once its review changes.
    return (
        <section className="review-panel" aria-label="Review this order" ref={(element) => { if (startOpen) element?.scrollIntoView({ block: "center" }) }}>
            <h3 className="order-section-title">Rate this order</h3>
            <ReviewTarget
                key={`shop-${state.data.shop?.id ?? "new"}-${state.data.shop?.rating}-${state.data.shop?.comment}`}
                heading="The shop"
                kind="shops"
                review={state.data.shop}
                onCreate={(rating, comment) => createOrderReview(checkoutId, sellerOrderId, { shop: { rating, ...(comment ? { comment } : {}) } })}
                onChanged={reload}
            />
            {state.data.products.map((product) => (
                <ReviewTarget
                    key={`product-${product.listingId}-${product.review?.id ?? "new"}-${product.review?.rating}-${product.review?.comment}`}
                    heading={product.title}
                    kind="products"
                    review={product.review}
                    onCreate={(rating, comment) => createOrderReview(checkoutId, sellerOrderId, { products: [{ listingId: product.listingId, rating, ...(comment ? { comment } : {}) }] })}
                    onChanged={reload}
                />
            ))}
        </section>
    )
}

export default OrderReviewsPanel
