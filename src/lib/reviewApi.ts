import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import type {
    AdminReviewPage,
    AdminReviewStatus,
    OrderReviews,
    ReviewPage,
    SellerReviewPage,
    SellerReviewType
} from "../types/review"

function hasArray(key: string) {
    return (value: unknown): boolean => isRecord(value) && Array.isArray(value[key])
}

// What the buyer can review on one delivered seller order, and what they already wrote.
export function fetchOrderReviews(checkoutId: number, sellerOrderId: number, signal?: AbortSignal): Promise<ApiResult<OrderReviews>> {
    return apiRequest<OrderReviews>(`/orders/${checkoutId}/seller-orders/${sellerOrderId}/reviews`, {
        signal,
        isValid: (value): value is OrderReviews => hasArray("products")(value) && isRecord(value) && typeof value.canReview === "boolean"
    })
}

export type NewReview = { rating: number, comment?: string, photoUrls?: string[] }

// Saves new reviews of the shop, of products in the order, or both at once. Nothing is saved unless
// every part is valid. Leave out products rather than sending an empty list.
export function createOrderReview(
    checkoutId: number,
    sellerOrderId: number,
    target: { shop?: NewReview, products?: Array<NewReview & { listingId: number }> }
): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/orders/${checkoutId}/seller-orders/${sellerOrderId}/reviews`, { method: "POST", body: target })
}

// kind is "products" or "shops" in the backend's paths.
export type ReviewKind = "products" | "shops"

// photoUrls replaces the review's photos; an empty list removes them all.
export function changeReview(kind: ReviewKind, reviewId: number, change: { rating?: number, comment?: string | null, photoUrls?: string[] }): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/reviews/${kind}/${reviewId}`, { method: "PATCH", body: change })
}

export function removeReview(kind: ReviewKind, reviewId: number): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/reviews/${kind}/${reviewId}`, { method: "DELETE" })
}

function reviewPageValid(value: unknown): value is ReviewPage {
    return hasArray("reviews")(value) && isRecord(value) && isRecord(value.summary)
}

// A product's or shop's public reviews. With `withPhotos` only the reviews that have photos are
// listed; the summary still covers every review.
export function fetchPublicReviews(
    kind: "product" | "shop",
    subject: string, // the listing's id, or the shop's slug
    page: number,
    withPhotos: boolean,
    signal?: AbortSignal
): Promise<ApiResult<ReviewPage>> {
    const path = kind === "product" ? `/listings/${encodeURIComponent(subject)}/reviews` : `/seller/shop/${encodeURIComponent(subject)}/reviews`
    const query = new URLSearchParams({ page: String(page), ...(withPhotos ? { withPhotos: "true" } : {}) })
    return apiRequest<ReviewPage>(`${path}?${query}`, { signal, isValid: reviewPageValid })
}

export function fetchMyReviews(type: SellerReviewType, page: number, signal?: AbortSignal): Promise<ApiResult<SellerReviewPage>> {
    return apiRequest<SellerReviewPage>(`/seller/reviews?type=${type}&page=${page}`, {
        signal,
        isValid: (value): value is SellerReviewPage => hasArray("reviews")(value)
    })
}

export function reportReview(type: SellerReviewType, reviewId: number, reason: string): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/seller/reviews/${type === "shop" ? "shops" : "products"}/${reviewId}/report`, { method: "POST", body: { reason } })
}

export function listAdminReviews(type: SellerReviewType, status: AdminReviewStatus, page: number, signal?: AbortSignal): Promise<ApiResult<AdminReviewPage>> {
    return apiRequest<AdminReviewPage>(`/admin/reviews?type=${type}&status=${status}&page=${page}`, {
        signal,
        isValid: (value): value is AdminReviewPage => hasArray("reviews")(value)
    })
}

export function setReviewHidden(type: SellerReviewType, reviewId: number, hide: boolean, reason: string): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/admin/reviews/${type === "shop" ? "shops" : "products"}/${reviewId}/${hide ? "hide" : "show"}`, {
        method: "POST",
        body: hide ? { reason } : {}
    })
}
