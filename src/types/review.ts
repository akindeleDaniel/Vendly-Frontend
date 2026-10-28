// Shapes of the review endpoints (reviewController.ts). A rating is a whole number from 1 to 5.

export const REVIEW_COMMENT_MAX_LENGTH = 1000

// A review as its writer sees it.
export type MyReview = {
  id: number
  rating: number
  comment: string | null
  createdAt: string
  hidden: boolean // an administrator has hidden it from the public
  canChange: boolean // false 7 days after it was written
}

// GET /orders/:id/seller-orders/:orderId/reviews
export type OrderReviews = {
  canReview: boolean
  shop: MyReview | null
  products: Array<{ listingId: number, title: string, review: MyReview | null }>
}

export type ReviewSummary = {
  average: number | null
  count: number
  distribution: Record<string, number> // "1" to "5"
}

// A review on a product or shop page.
export type PublicReview = {
  id: number
  rating: number
  comment: string | null
  reviewer: string // for example "Ada O."
  createdAt: string
  edited: boolean
}

// GET /listings/:id/reviews and GET /seller/shop/:slug/reviews
export type ReviewPage = {
  page: number
  pageSize: number
  summary: ReviewSummary
  reviews: PublicReview[]
}

export type SellerReviewType = "shop" | "product"

// A review of the seller's own shop or product (GET /seller/reviews).
export type SellerReview = {
  id: number
  rating: number
  comment: string | null
  reviewer: string
  createdAt: string
  reported: boolean
  hidden: boolean
  photoUrls?: string[]
  listing?: { id: number, title: string }
}

export type SellerReviewPage = {
  page: number
  pageSize: number
  total: number
  reviews: SellerReview[]
  // The open tab's visible reviews, as shoppers' rating counts them.
  summary?: ReviewSummary & { withPhotos: number }
  // How many reviews each tab lists, hidden and reported ones included.
  counts?: { shop: number, product: number }
}

export type AdminReviewStatus = "reported" | "hidden" | "visible" | "all"

// A review in the administrator's list (GET /admin/reviews).
export type AdminReview = {
  id: number
  type: SellerReviewType
  rating: number
  comment: string | null
  createdAt: string
  reportedAt: string | null
  reportReason: string | null
  hiddenAt: string | null
  hiddenReason: string | null
  photoUrls?: string[] // up to 3, added by the buyer; often none
  orderId: number
  buyer: { id: number, name: string, email: string }
  subject: { id: number, title?: string, businessName?: string, slug?: string }
}

export type AdminReviewPage = {
  page: number
  pageSize: number
  total: number
  reviews: AdminReview[]
}
