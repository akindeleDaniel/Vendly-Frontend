export type ShippingPolicy = "FREE" | "FIXED"

export type SellerProfile = {
  businessName: string
  state: string
  lga: string
  shippingPolicy: ShippingPolicy
  shippingCost: string
}

import type { ShopTrust } from "./trust"

export type ShopSummary = {
  id: number | string
  businessName: string
  state?: string | null
  lga?: string | null
  location?: string | null
  logoUrl?: string | null
  slug: string
  trust?: ShopTrust
}
