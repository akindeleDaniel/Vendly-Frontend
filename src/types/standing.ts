// A seller's standing (sellerStandingController.ts). A complaint that ends in a refund against the
// seller, which the seller did not agree to, is a strike. Strikes older than the window stop counting.

export type SellerStanding = {
  strikes: number
  warnAt: number // a warning at this many strikes
  blockAt: number // the shop is blocked at this many
  windowDays: number
  warned: boolean
  blocked: boolean
  blockedAt: string | null
  blockReason: string | null
  recent: Array<{ disputeId: number, orderId: number, reason: string, resolvedAt: string }>
}
