export type ShippingPolicy = "FREE" | "FIXED"

export type SellerProfile = {
  businessName: string
  state: string
  lga: string
  shippingPolicy: ShippingPolicy
  shippingCost: string
}

import type { ShopTrust } from "./trust"
import type { BrandColor } from "./branding"

export type ShopSummary = {
  id: number | string
  businessName: string
  state?: string | null
  lga?: string | null
  location?: string | null
  logoUrl?: string | null
  slug: string
  trust?: ShopTrust
  ratingAverage?: number | null // one decimal; null until the first review
  ratingCount?: number
  branding?: { bannerUrl: string | null, brandColor: BrandColor | null } // for the strip across the top of the card
}
