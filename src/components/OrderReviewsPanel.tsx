import { useState } from "react"
import Notice from "./Notice"
import PhotoViewer from "./PhotoViewer"
import ReviewPhotoField from "./ReviewPhotoField"
import ReviewPhotoThumbs from "./ReviewPhotoThumbs"
import ShopAvatar from "./ShopAvatar"
import StarInput from "./StarInput"
import StarRating from "./StarRating"
import { changeReview, createOrderReview, fetchOrderReviews, removeReview } from "../lib/reviewApi"
import type { NewReview, ReviewKind } from "../lib/reviewApi"
import { failureMessage } from "../lib/apiRequest"
import { formatOrderDay } from "../lib/buyerOrders"
import { useApiResource } from "../lib/useApiResource"
import { useReviewPhotos } from "../lib/useReviewPhotos"
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

// A photo still uploading, or one that failed, holds a review back until it is done or removed.
function photoHoldUp(uploading: number, failed: number): string {
    if (uploading > 0) {
        return uploading === 1 ? "Waiting for 1 photo to finish uploading." : `Waiting for ${uploading} photos to finish uploading.`
    }

    return failed > 0 ? "A photo didn't upload. Try it again, or remove it." : ""
}

type EditReviewFormProps = {
    about: string
    kind: ReviewKind
    review: MyReview
    onSaved: () => void
    onCancel: () => void
}

// Changing a written review: the stars, the comment and the photos.
function EditReviewForm({ about, kind, review, onSaved, onCancel }: EditReviewFormProps) {
    const [rating, setRating] = useState(review.rating)
    const [comment, setComment] = useState(review.comment ?? "")
    const photos = useReviewPhotos({ edit: review.photoUrls ?? [] })
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const holdUp = photoHoldUp(photos.countWhere(["edit"], "uploading"), photos.countWhere(["edit"], "failed"))

    async function save(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isWorking || holdUp) {
            return
        }
        setIsWorking(true)
        setError("")
        const trimmed = comment.trim()
        const result = await changeReview(kind, review.id, { rating, comment: trimmed === "" ? null : trimmed, photoUrls: photos.urlsFor("edit") })
        setIsWorking(false)

        if (result.kind === "ok") {
            onSaved()
        } else {
            setError(failureMessage(result))
        }
    }

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
            <ReviewPhotoField target="edit" about={about} photos={photos} disabled={isWorking} />
            {error && <Notice kind="error">{error}</Notice>}
            <div className="review-actions">
                <button type="submit" className="btn btn-primary" disabled={isWorking || holdUp !== ""}>{isWorking ? "Saving..." : "Save changes"}</button>
                <button type="button" className="btn" disabled={isWorking} onClick={onCancel}>Cancel</button>
                {holdUp && <span className="review-hint" role="status">{holdUp}</span>}
            </div>
        </form>
    )
}

// A review the shopper has written, with its photos, and Edit and Delete for the first 7 days.
function WrittenReview({ about, kind, review, onChanged }: WrittenReviewProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const [openPhoto, setOpenPhoto] = useState<number | null>(null)
    const written = new Date(review.createdAt)
    const changeUntil = Number.isNaN(written.getTime()) ? "" : formatOrderDay(new Date(written.getTime() + CHANGE_DAYS * 86_400_000).toISOString())
    const photoUrls = review.photoUrls ?? []

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
        return <EditReviewForm about={about} kind={kind} review={review} onSaved={() => { setIsEditing(false); onChanged() }} onCancel={() => setIsEditing(false)} />
    }

    return (
        <div className="review-written">
            <div className="review-written-head">
                <b>{about}</b>
                <StarRating average={review.rating} count={1} showCount={false} />
            </div>
            {review.comment && <p className="review-written-comment">{review.comment}</p>}
            <ReviewPhotoThumbs urls={photoUrls} who="your" onOpen={setOpenPhoto} />
            <PhotoViewer
                photos={photoUrls}
                index={openPhoto}
                caption={`Your review of ${about}`}
                quote={review.comment}
                onIndex={setOpenPhoto}
                onClose={() => setOpenPhoto(null)}
            />
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
    const photos = useReviewPhotos()
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

    // Only the photos of what is being rated count: a photo under a target with no stars is not sent.
    const ratedKeys = pending.filter((target) => (ratings[target.key] ?? 0) > 0).map((target) => target.key)
    const holdUp = photoHoldUp(photos.countWhere(ratedKeys, "uploading"), photos.countWhere(ratedKeys, "failed"))

    async function post(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isPosting || holdUp) {
            return
        }

        const reviewOf = (key: string): NewReview => {
            const comment = (comments[key] ?? "").trim()
            const photoUrls = photos.urlsFor(key)
            return { rating: ratings[key], ...(comment ? { comment } : {}), ...(photoUrls.length > 0 ? { photoUrls } : {}) }
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
            photos.clear()
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
                                    <>
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
                                        <ReviewPhotoField target={target.key} about={target.isShop ? "the shop" : target.name} photos={photos} disabled={isPosting} />
                                    </>
                                )}
                            </div>
                        )
                    })}
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="review-actions">
                        <button type="submit" className="btn btn-primary" disabled={isPosting || holdUp !== ""}>{isPosting ? "Posting..." : "Post review"}</button>
                        {holdUp
                            ? <span className="review-hint" role="status">{holdUp}</span>
                            : pending.length > 1 && <span className="review-hint">Rate the shop, a product, or both.</span>}
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
