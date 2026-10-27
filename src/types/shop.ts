import type { ShopTrust } from "./trust"
import type { ShopBranding } from "./branding"

// A shop as shoppers see it (GET /seller/shop/:slug).
export type ShopProfile = {
    businessName: string
    location: string
    logoUrl: string
    slug: string
    shippingPolicy?: "FREE" | "FIXED"
    shippingCost?: string | null// a naira amount, or null for free delivery
    ratingAverage?: number | null
    ratingCount?: number
    foodOrderType?: "NOW" | "PRE_ORDER" | "BOTH"
    trust?: ShopTrust
    branding?: ShopBranding
    deliversEverywhere?: boolean
    shippingRates?: Array<{ state: string, cost: string | null }>// cost null: no delivery to that state
}
