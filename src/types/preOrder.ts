// Pre-orders for food shops (preOrderController.ts). A buyer asks a shop for a ready time, the shop
// approves or declines, and an approved request is paid for through the normal checkout.

export type PreOrderStatus = "REQUESTED" | "APPROVED" | "DECLINED" | "EXPIRED" | "CANCELLED" | "USED"

export type FoodOrderType = "NOW" | "PRE_ORDER" | "BOTH"

export type PreOrder = {
  id: number
  status: PreOrderStatus
  readyAt: string
  note: string | null // the buyer's note
  sellerNote: string | null // the shop's note with its answer
  respondBy: string | null // the shop has until then to answer
  payBy: string | null // once approved, the buyer has until then to pay
  decidedAt: string | null
  createdAt: string
  items: Array<{ listingId: number, title: string, quantity: number, unitPrice: string }>
  subtotal: string
  seller: { businessName: string, slug: string }
  buyerName?: string // sellers only, first name
}

export type PreOrderPage = {
  page: number
  pageSize: number
  total: number
  preOrders: PreOrder[]
}

// A pre-order approved for the cart's items, as the checkout preview reports it.
export type ApprovedPreOrder = { id: number, readyAt: string, payBy: string | null }

export const PRE_ORDER_NOTE_MAX_LENGTH = 500
export const PRE_ORDER_MIN_HOURS_AHEAD = 6
export const PRE_ORDER_MAX_DAYS_AHEAD = 30

export const FOOD_ORDER_TYPE_OPTIONS: Array<{ value: FoodOrderType, label: string }> = [
  { value: "NOW", label: "Ready to deliver now (no pre-orders)" },
  { value: "PRE_ORDER", label: "Pre-orders only" },
  { value: "BOTH", label: "Both: now, or by pre-order" }
]
