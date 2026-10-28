import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { Image } from "lucide-react"
import { AdminFilters, AdminListHead, AdminPager } from "../components/AdminList"
import Notice from "../components/Notice"
import PhotoViewer from "../components/PhotoViewer"
import ReviewStars from "../components/ReviewStars"
import { pageOf } from "../lib/adminDisplay"
import { failureMessage } from "../lib/apiRequest"
import { formatShortDate } from "../lib/orderApi"
import { listAdminReviews, setReviewHidden } from "../lib/reviewApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminReview, AdminReviewStatus, SellerReviewType } from "../types/review"

const STATUS_FILTERS: Array<{ value: AdminReviewStatus, label: string }> = [
    { value: "reported", label: "Reported" },
    { value: "hidden", label: "Hidden" },
    { value: "visible", label: "Visible" },
    { value: "all", label: "All" }
]

const TYPES: Array<{ value: SellerReviewType, label: string }> = [
    { value: "product", label: "Products" },
    { value: "shop", label: "Shops" }
]

const REASON_MIN = 3
const REASON_MAX = 300

type OpenPhotos = { review: AdminReview, index: number }

function subjectName(review: AdminReview): string {
    return (review.type === "shop" ? review.subject.businessName : review.subject.title) ?? "Deleted"
}

function subjectLink(review: AdminReview): string | null {
    if (review.type === "shop") {
        return review.subject.slug ? `/shop/${review.subject.slug}` : null
    }

    return `/product/${review.subject.id}`
}

function ReviewActions({ review, onChanged }: { review: AdminReview, onChanged: () => void }) {
    const id = useId()
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

    if (isHiding && !isHidden) {
        return (
            <div className="admin-confirm">
                <div className="product-field">
                    <label htmlFor={id}>Why is it being hidden?</label>
                    <textarea id={id} className="product-input" rows={3} maxLength={REASON_MAX} value={reason} disabled={isWorking} onChange={(event) => setReason(event.target.value)} />
                    <p className="product-help">{REASON_MIN} to {REASON_MAX} characters. Hiding it takes it and its photos off the shop's pages and out of the rating.</p>
                </div>
                {error && <Notice kind="error">{error}</Notice>}
                <div className="admin-actions-row">
                    <button type="button" className="btn btn-primary" onClick={() => run(true)} disabled={isWorking}>{isWorking ? "Hiding..." : "Hide the review"}</button>
                    <button type="button" className="btn" onClick={() => { setIsHiding(false); setError("") }} disabled={isWorking}>Cancel</button>
                </div>
            </div>
        )
    }

    return (
        <>
            {error && <Notice kind="error">{error}</Notice>}
            <div className="admin-actions-row is-split">
                {isHidden
                    ? <button type="button" className="btn" onClick={() => run(false)} disabled={isWorking}>{isWorking ? "Working..." : "Show it again"}</button>
                    : <button type="button" className="btn" onClick={() => setIsHiding(true)}>Hide this review</button>}
            </div>
        </>
    )
}

function ReviewCard({ review, onChanged, onOpenPhoto }: { review: AdminReview, onChanged: () => void, onOpenPhoto: (index: number) => void }) {
    const photos = review.photoUrls ?? []
    const link = subjectLink(review)
    const isReported = review.reportedAt !== null && review.hiddenAt === null
    const pill = review.hiddenAt !== null
        ? { label: "Hidden", tone: "neutral" }
        : review.reportedAt !== null ? { label: "Reported", tone: "attention" } : { label: "Visible", tone: "done" }

    return (
        <li className={`money-card admin-card${isReported ? " is-hot" : ""}`}>
            <div className="admin-review-head">
                <ReviewStars rating={review.rating} size={17} />
                {link ? <Link to={link} className="admin-review-subject">{subjectName(review)}</Link> : <b className="admin-review-subject">{subjectName(review)}</b>}
                <span className="admin-review-date">{formatShortDate(review.createdAt)}</span>
                <span className="admin-review-side">
                    {photos.length > 0 && (
                        <span className="admin-photo-count"><Image size={15} aria-hidden="true" />{photos.length === 1 ? "1 photo" : `${photos.length} photos`}</span>
                    )}
                    <span className={`orders-status is-${pill.tone}`}>{pill.label}</span>
                </span>
            </div>
            {review.comment ? <p className="admin-card-text">{review.comment}</p> : <p className="product-help">Stars only, no comment.</p>}
            {photos.length > 0 && (
                <div className="admin-review-photos">
                    {photos.map((url, index) => (
                        <button key={url} type="button" className="admin-review-photo" aria-label={`Open photo ${index + 1} of ${photos.length}`} onClick={() => onOpenPhoto(index)}>
                            <img src={url} alt="" loading="lazy" />
                        </button>
                    ))}
                </div>
            )}
            {review.reportedAt && (
                <p className="admin-why is-attention">
                    <b>Reported by the seller on {formatShortDate(review.reportedAt)}</b>
                    {review.reportReason ? `“${review.reportReason}”` : "No reason given."}
                </p>
            )}
            {review.hiddenAt && (
                <p className="admin-why is-neutral">
                    <b>Hidden on {formatShortDate(review.hiddenAt)}</b>
                    {review.hiddenReason ?? "No reason given."}
                </p>
            )}
            <p className="admin-review-by">
                By <Link to={`/admin/users/${review.buyer.id}`}>{review.buyer.name}</Link> · {review.buyer.email} · <Link to={`/admin/orders/${review.orderId}`}>Order {review.orderId}</Link>
            </p>
            <ReviewActions review={review} onChanged={onChanged} />
        </li>
    )
}

// Reviews for an administrator to look at, the ones sellers reported first, with the buyers' photos.
// Hiding a review takes it off the public pages and out of the average; showing it puts it back.
function AdminReviewsPage() {
    useDocumentTitle("Reviews")
    const [type, setType] = useState<SellerReviewType>("product")
    const [status, setStatus] = useState<AdminReviewStatus>("reported")
    const [page, setPage] = useState(1)
    const [openPhotos, setOpenPhotos] = useState<OpenPhotos | null>(null)
    const { state, reload } = useApiResource(`${type}|${status}|${page}`, (signal) => listAdminReviews(type, status, page, signal))

    return (
        <div className="admin-page">
            <AdminListHead title="Reviews" intro="Reported reviews come first. Hide one that breaks the rules; its photos are hidden with it." />

            <div className="admin-tools admin-tools-row">
                <div className="admin-segments" role="group" aria-label="Reviews of">
                    {TYPES.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={option.value === type ? "is-on" : undefined}
                            aria-pressed={option.value === type}
                            onClick={() => { setType(option.value); setPage(1) }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <AdminFilters label="Show" options={STATUS_FILTERS} value={status} onChange={(value) => { setStatus(value); setPage(1) }} />
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
                    <p className="admin-count">
                        <span><b>{state.data.total.toLocaleString("en-NG")}</b> {state.data.total === 1 ? "review" : "reviews"}</span>
                        <span>{pageOf(page, state.data.pageSize, state.data.total)}</span>
                    </p>
                    {state.data.reviews.length === 0 ? (
                        <div className="orders-none"><p>{status === "reported" ? "No reported reviews. Nothing to look at." : "No reviews match."}</p></div>
                    ) : (
                        <ul className="admin-cards">
                            {state.data.reviews.map((review) => (
                                <ReviewCard
                                    key={`${review.type}-${review.id}`}
                                    review={review}
                                    onChanged={reload}
                                    onOpenPhoto={(index) => setOpenPhotos({ review, index })}
                                />
                            ))}
                        </ul>
                    )}
                    <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}

            <PhotoViewer
                photos={openPhotos?.review.photoUrls ?? []}
                index={openPhotos?.index ?? null}
                caption={openPhotos ? `From ${openPhotos.review.buyer.name}'s review of ${subjectName(openPhotos.review)}` : ""}
                onIndex={(index) => setOpenPhotos((open) => open && { ...open, index })}
                onClose={() => setOpenPhotos(null)}
            />
        </div>
    )
}

export default AdminReviewsPage
