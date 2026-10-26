// What only super administrators see: platform figures, the administrator team and the audit log
// (platformController.ts, adminTeamController.ts). Money values are naira strings with two decimals.

export type SalesFigures = {
  payments: number
  paid: string // what buyers paid through StoreHatch
  refunds: number
  refunded: string
  net: string // paid minus refunded
}

// The value of sales through StoreHatch. It is not StoreHatch's own income: StoreHatch takes no commission on orders.
export type PlatformSummary = {
  generatedAt: string
  users: { total: number, buyers: number, sellers: number, admins: number, joinedLast7Days: number, joinedLast30Days: number, emailNotConfirmed: number }
  shops: { total: number, withPayoutAccount: number, warned: number, blocked: number, listingsOnSale: number }
  orders: { paid: number, toShip: number, shipped: number, delivered: number, refunded: number, last7Days: number, last30Days: number }
  sales: { allTime: SalesFigures, last30Days: SalesFigures, last7Days: SalesFigures, today: SalesFigures }
  refunds: { pending: number, processing: number, needsAttention: number, failed: number, amountInProgress: string }
  complaints: { awaitingSeller: number, overdueSellerResponse: number, sellerAgreedAwaitingApproval: number, awaitingDecision: number }
  sellerDebts: { open: number, amountStillOwed: string, recoveryCasesOpen: number }
  needsAttention: { reportedReviews: number, preOrdersAwaitingSeller: number }
  topSellersLast30Days: Array<{ sellerId: number, businessName: string, slug: string, orders: number, sales: string }>
}

export type TeamMember = {
  id: number
  name: string
  email: string
  isSuperAdmin: boolean
  createdAt: string
}

export type AdminAction =
  | "ADMIN_GRANTED"
  | "ADMIN_REVOKED"
  | "SUPER_ADMIN_GRANTED"
  | "SUPER_ADMIN_REMOVED"
  | "SELLER_BLOCKED"
  | "SELLER_UNBLOCKED"

export type AuditEntry = {
  id: number
  action: AdminAction
  actor: { id: number, name: string, email: string | null }
  target: { id: number, name: string, email: string | null } | null
  detail: string | null
  createdAt: string
}

export type AuditLogPage = {
  page: number
  pageSize: number
  total: number
  entries: AuditEntry[]
}

export const AUDIT_ACTION_LABELS: Record<AdminAction, string> = {
  ADMIN_GRANTED: "Made an administrator",
  ADMIN_REVOKED: "Removed as an administrator",
  SUPER_ADMIN_GRANTED: "Made a super administrator",
  SUPER_ADMIN_REMOVED: "Super administrator level removed",
  SELLER_BLOCKED: "Blocked a shop",
  SELLER_UNBLOCKED: "Lifted a shop's block"
}
