import type { ApprovedPreOrder, FoodOrderType } from "./preOrder"

// Shapes of the checkout endpoints as implemented by the backend (checkoutController.ts).
// All money values are strings with two decimals, calculated by the server.

export type ReviewItem = {
  listingId: number
  title: string
  description: string
  imageUrl: string | null
  category: string
  unitPrice: string
  quantity: number
  lineSubtotal: string
  stockQuantity: number
  availableQuantity: number
}

export type ReviewSeller = {
  seller: {
    businessName: string
    slug: string
  }
  // How a food shop takes orders, and for a shop that takes pre-orders whether one is needed and
  // whether an approved request exists for exactly what is in the cart.
  orderType?: FoodOrderType
  preOrder?: { required: boolean, approved: ApprovedPreOrder | null }
  items: ReviewItem[]
  subtotal: string
  shipping: string
  total: string
}

// Returned by GET /checkout/preview, and inside a CHECKOUT_REVIEW_REQUIRED conflict as `review`.
export type CheckoutReview = {
  reviewToken: string
  sellers: ReviewSeller[]
  subtotal: string
  shipping: string
  total: string
}

// The delivery form. Every field is a string while editing.
export type DeliveryDetails = {
  fullName: string
  phone: string
  address: string
  state: string
  lga: string
  instructions: string
}

export type CheckoutSuccessCode = "CHECKOUT_CREATED" | "CHECKOUT_REPLACED" | "CHECKOUT_REUSED"

export type CheckoutOrderItem = {
  listingId: number
  title: string
  unitPrice: string
  quantity: number
}

export type CheckoutOrder = {
  id: number
  fulfilmentType?: "NOW" | "PRE_ORDER"
  readyAt?: string | null
  seller: {
    businessName: string
    slug: string
  } | null
  status: string
  subtotal: string
  shipping: string
  total: string
  items: CheckoutOrderItem[]
}

// Returned by POST /checkout: 201 for CREATED and REPLACED, 200 for REUSED.
export type CheckoutResult = {
  code: CheckoutSuccessCode
  checkout: {
    id: number
    status: string
    expiresAt: string
    delivery: {
      fullName: string
      phone: string
      address: string
      state: string
      lga: string
      instructions: string | null
    }
  }
  items: CheckoutOrderItem[]
  subtotal: string
  shipping: string
  total: string
  orders: CheckoutOrder[]
}

// Supplied with a CHECKOUT_LOCKED conflict.
export type LockedCheckout = {
  id: number
  status: string
  expiresAt: string
}
