import type { StoreProfile } from "../components/StoreOverview"
import type { BrandColor } from "../types/branding"

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null
}

function isBrandColor(value: unknown): value is BrandColor {
    return isRecord(value) && typeof value.background === "string" && typeof value.text === "string" && typeof value.name === "string"
}

// What My store shows about the shop, read from GET /seller/profile. Anything missing falls back to
// "not set", so an older or partial answer never breaks the page.
export function toStoreProfile(body: unknown): StoreProfile {
    const profile = isRecord(body) ? body : {}
    const branding = isRecord(profile.branding) ? profile.branding : {}
    const foodOrderType = profile.foodOrderType

    return {
        businessName: text(profile.businessName) ?? "My store",
        slug: text(profile.slug) ?? "",
        logoUrl: text(profile.logoUrl),
        location: text(profile.location),
        ratingAverage: typeof profile.ratingAverage === "number" ? profile.ratingAverage : null,
        ratingCount: typeof profile.ratingCount === "number" ? profile.ratingCount : 0,
        takesPreOrders: foodOrderType === "PRE_ORDER" || foodOrderType === "BOTH",
        // Delivery is chosen when the shop is set up: free, or a fee.
        hasDelivery: profile.shippingPolicy === "FREE" || text(profile.shippingCost) !== null,
        branding: {
            bannerUrl: text(branding.bannerUrl),
            brandColor: isBrandColor(branding.brandColor) ? branding.brandColor : null
        }
    }
}
