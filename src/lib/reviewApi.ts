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

export type NewReview = { rating: number, comment?: string }

// Saves one new review: of the shop or of one product in the order.
export function createOrderReview(
    checkoutId: number,
    sellerOrderId: number,
    target: { shop: NewReview } | { products: Array<NewReview & { listingId: number }> }
): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/orders/${checkoutId}/seller-orders/${sellerOrderId}/reviews`, { method: "POST", body: target })
}

// kind is "products" or "shops" in the backend's paths.
export type ReviewKind = "products" | "shops"

export function changeReview(kind: ReviewKind, reviewId: number, change: { rating?: number, comment?: string | null }): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/reviews/${kind}/${reviewId}`, { method: "PATCH", body: change })
}

export function removeReview(kind: ReviewKind, reviewId: number): Promise<ApiResult<unknown>> {
    return apiRequest<unknown>(`/reviews/${kind}/${reviewId}`, { method: "DELETE" })
}

function reviewPageValid(value: unknown): value is ReviewPage {
    return hasArray("reviews")(value) && isRecord(value) && isRecord(value.summary)
}

export function fetchListingReviews(listingId: string | number, page: number, signal?: AbortSignal): Promise<ApiResult<ReviewPage>> {
    return apiRequest<ReviewPage>(`/listings/${encodeURIComponent(String(listingId))}/reviews?page=${page}`, { signal, isValid: reviewPageValid })
}

export function fetchShopReviews(slug: string, page: number, signal?: AbortSignal): Promise<ApiResult<ReviewPage>> {
    return apiRequest<ReviewPage>(`/seller/shop/${encodeURIComponent(slug)}/reviews?page=${page}`, { signal, isValid: reviewPageValid })
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
