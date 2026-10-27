import { useState } from "react"
import Notice from "./Notice"
import ShopAvatar from "./ShopAvatar"
import StarInput from "./StarInput"
import StarRating from "./StarRating"
import { changeReview, createOrderReview, fetchOrderReviews, removeReview } from "../lib/reviewApi"
import type { NewReview, ReviewKind } from "../lib/reviewApi"
import { failureMessage } from "../lib/apiRequest"
import { formatOrderDay } from "../lib/buyerOrders"
import { useApiResource } from "../lib/useApiResource"
import type { BrandColor } from "../types/branding"
import type { OrderItem } from "../types/order"
import { REVIEW_COMMENT_MAX_LENGTH } from "../types/review"
import type { MyReview } from "../types/review"

// How long a review can be changed or deleted after it is written (the backend enforces it).
const CHANGE_DAYS = 7
const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]

type Shop = { name: string, logoUrl?: string | null, brandColor?: BrandColor }

// The thing being rated: the shop, or one product in the order with its photo.
function TargetPicture({ shop, item }: { shop?: Shop, item?: OrderItem }) {
    if (shop) {
        return <ShopAvatar name={shop.name} logoUrl={shop.logoUrl} brandColor={shop.brandColor} />
    }

    return item?.imageUrl
        ? <img className="review-target-photo" src={item.imageUrl} alt="" />
        : <span className="review-target-photo" aria-hidden="true" />
}

type WrittenReviewProps = {
    about: string
    kind: ReviewKind
    review: MyReview
    onChanged: () => void
}

// A review the shopper has written, with Edit and Delete for the first 7 days.
function WrittenReview({ about, kind, review, onChanged }: WrittenReviewProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [rating, setRating] = useState(review.rating)
    const [comment, setComment] = useState(review.comment ?? "")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const written = new Date(review.createdAt)
    const changeUntil = Number.isNaN(written.getTime()) ? "" : formatOrderDay(new Date(written.getTime() + CHANGE_DAYS * 86_400_000).toISOString())

    async function save(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isWorking) {
            return
        }
        setIsWorking(true)
        setError("")
        const trimmed = comment.trim()
        const result = await changeReview(kind, review.id, { rating, comment: trimmed === "" ? null : trimmed })
        setIsWorking(false)

        if (result.kind === "ok") {
            setIsEditing(false)
            onChanged()
        } else {
            setError(failureMessage(result))
        }
    }

    async function remove() {
        if (isWorking || !window.confirm(`Delete your review of ${about}?`)) {
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

    if (isEditing) {
        return (
            <form className="review-written" onSubmit={save}>
                <div className="review-written-head">
                    <b>{about}</b>
                    <StarInput label={`Your rating of ${about}`} value={rating} onChange={setRating} disabled={isWorking} hideLabel />
                </div>
                <label className="review-comment">
                    Comment (optional)
                    <textarea maxLength={REVIEW_COMMENT_MAX_LENGTH} value={comment} disabled={isWorking} onChange={(event) => setComment(event.target.value)} />
                </label>
                {error && <Notice kind="error">{error}</Notice>}
                <div className="review-actions">
                    <button type="submit" className="btn btn-primary" disabled={isWorking}>{isWorking ? "Saving..." : "Save changes"}</button>
                    <button
                        type="button"
                        className="btn"
                        disabled={isWorking}
                        onClick={() => { setIsEditing(false); setRating(review.rating); setComment(review.comment ?? ""); setError("") }}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        )
    }

    return (
        <div className="review-written">
            <div className="review-written-head">
                <b>{about}</b>
                <StarRating average={review.rating} count={1} showCount={false} />
            </div>
            {review.comment && <p className="review-written-comment">{review.comment}</p>}
            {review.hidden && <Notice kind="warning">StoreHatch has hidden this review from the public.</Notice>}
            {error && <Notice kind="error">{error}</Notice>}
            <div className="review-written-meta">
                <span>
                    Written {formatOrderDay(review.createdAt)}
                    {review.canChange && changeUntil ? ` · You can change it until ${changeUntil}` : ""}
                </span>
                {review.canChange && (
                    <>
                        <button type="button" className="btn-quiet" onClick={() => setIsEditing(true)} disabled={isWorking}>Edit</button>
                        <button type="button" className="btn-quiet" onClick={remove} disabled={isWorking}>Delete</button>
                    </>
                )}
            </div>
        </div>
    )
}

type OrderReviewsPanelProps = {
    checkoutId: number
    sellerOrderId: number
    shop: Shop
    items: OrderItem[]// the order's lines, for the products' photos and options
    scrollIntoView?: boolean// true when the shopper came here from a "Review your order" button
}

// After an order is delivered the shopper can rate the shop and each product in it, all in one go.
// A review can be changed or deleted for 7 days.
function OrderReviewsPanel({ checkoutId, sellerOrderId, shop, items, scrollIntoView = false }: OrderReviewsPanelProps) {
    const { state, reload } = useApiResource(`${checkoutId}|${sellerOrderId}`, (signal) => fetchOrderReviews(checkoutId, sellerOrderId, signal))
    const [ratings, setRatings] = useState<Record<string, number>>({})
    const [comments, setComments] = useState<Record<string, string>>({})
    const [isPosting, setIsPosting] = useState(false)
    const [error, setError] = useState("")

    if (state.kind === "loading") {
        return <p role="status" className="review-loading">Loading reviews...</p>
    }

    if (state.kind === "error") {
        return (
            <Notice kind="error">
                <p>{state.message}</p>
                <button type="button" className="btn" onClick={reload}>Try again</button>
            </Notice>
        )
    }

    if (!state.data.canReview) {
        return null
    }

    const itemFor = (listingId: number) => items.find((item) => item.listingId === listingId)
    const productName = (listingId: number, title: string) => itemFor(listingId)?.productTitle ?? title
    const pending = [
        ...(state.data.shop === null ? [{ key: "shop", name: shop.name, ask: "How was the shop? Service, packing, delivery.", isShop: true, listingId: 0 }] : []),
        ...state.data.products
            .filter((product) => product.review === null)
            .map((product) => {
                const item = itemFor(product.listingId)
                return {
                    key: `product-${product.listingId}`,
                    name: productName(product.listingId, product.title),
                    ask: [item?.optionLabel, item?.sizeLabel].filter(Boolean).join(" · ") || "Was it as described?",
                    isShop: false,
                    listingId: product.listingId
                }
            })
    ]
    const written = [
        ...(state.data.shop ? [{ key: "shop", about: shop.name, kind: "shops" as const, review: state.data.shop }] : []),
        ...state.data.products.flatMap((product) => product.review
            ? [{ key: `product-${product.listingId}`, about: productName(product.listingId, product.title), kind: "products" as const, review: product.review }]
            : [])
    ]

    async function post(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isPosting) {
            return
        }

        const reviewOf = (key: string): NewReview => {
            const comment = (comments[key] ?? "").trim()
            return { rating: ratings[key], ...(comment ? { comment } : {}) }
        }
        const rated = pending.filter((target) => (ratings[target.key] ?? 0) > 0)

        if (rated.length === 0) {
            setError("Choose stars for the shop, a product, or both.")
            return
        }

        const shopTarget = rated.find((target) => target.isShop)
        const products = rated.filter((target) => !target.isShop).map((target) => ({ listingId: target.listingId, ...reviewOf(target.key) }))
        setIsPosting(true)
        setError("")
        const result = await createOrderReview(checkoutId, sellerOrderId, {
            ...(shopTarget ? { shop: reviewOf(shopTarget.key) } : {}),
            ...(products.length > 0 ? { products } : {})
        })
        setIsPosting(false)

        if (result.kind === "ok") {
            setRatings({})
            setComments({})
            reload()
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <div className="review-panel" ref={(element) => { if (scrollIntoView) element?.scrollIntoView({ block: "center" }) }}>
            {pending.length > 0 && (
                <form className="review-form" onSubmit={post} aria-labelledby={`review-title-${sellerOrderId}`}>
                    <div>
                        <h3 id={`review-title-${sellerOrderId}`}>Rate this order</h3>
                        <p className="review-sub">Your review shows on the shop's page with your first name. You can change it for {CHANGE_DAYS} days.</p>
                    </div>
                    {pending.map((target) => {
                        const rating = ratings[target.key] ?? 0
                        return (
                            <div key={target.key} className="review-target">
                                <div className="review-target-row">
                                    <TargetPicture shop={target.isShop ? shop : undefined} item={target.isShop ? undefined : itemFor(target.listingId)} />
                                    <div className="review-target-name">
                                        <b>{target.name}</b>
                                        <span>{target.ask}</span>
                                    </div>
                                    <StarInput
                                        label={`Rate ${target.name}`}
                                        value={rating}
                                        onChange={(value) => setRatings((current) => ({ ...current, [target.key]: value }))}
                                        disabled={isPosting}
                                        hideLabel
                                    />
                                    <span className="review-target-word" aria-live="polite">{RATING_WORDS[rating]}</span>
                                </div>
                                {rating > 0 && (
                                    <label className="review-comment">
                                        {target.isShop ? "About the shop (optional)" : `About the ${target.name} (optional)`}
                                        <textarea
                                            maxLength={REVIEW_COMMENT_MAX_LENGTH}
                                            value={comments[target.key] ?? ""}
                                            disabled={isPosting}
                                            placeholder={target.isShop ? "What went well, or what could be better?" : "Was it as described? Would you buy it again?"}
                                            onChange={(event) => setComments((current) => ({ ...current, [target.key]: event.target.value }))}
                                        />
                                    </label>
                                )}
                            </div>
                        )
                    })}
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="review-actions">
                        <button type="submit" className="btn btn-primary" disabled={isPosting}>{isPosting ? "Posting..." : "Post review"}</button>
                        {pending.length > 1 && <span className="review-hint">Rate the shop, a product, or both.</span>}
                    </div>
                </form>
            )}

            {written.length > 0 && (
                <section className="review-done" aria-label="Your reviews">
                    <h3>{written.length === 1 ? "Your review" : "Your reviews"}</h3>
                    {written.map((entry) => (
                        <WrittenReview
                            key={`${entry.key}-${entry.review.id}-${entry.review.rating}-${entry.review.comment}`}
                            about={entry.about}
                            kind={entry.kind}
                            review={entry.review}
                            onChanged={reload}
                        />
                    ))}
                </section>
            )}
        </div>
    )
}

export default OrderReviewsPanel
