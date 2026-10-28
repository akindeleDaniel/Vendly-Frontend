import type { CSSProperties } from "react"
import type { Listing } from "../types/listing"
import type { ShopProfile } from "../types/shop"
import { BRAND_COLORS } from "../types/branding"
import type { BrandColor } from "../types/branding"
import { formatNaira } from "./money"
import { ALL_STATES } from "./shippingApi"

const NEW_FOR_DAYS = 30

// Glides to a part of the page (straight there for people who ask for less motion), then optionally
// moves focus into it. The parts keep clear of the sticky shop header through scroll-margin-top in shop.css.
export function scrollToSection(id: string, focusId?: string) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
    if (focusId) {
        document.getElementById(focusId)?.focus({ preventScroll: true })
    }
}

// The shop's colour as CSS variables for its page. A shop that has not picked one gets Forest. Every
// colour offered is dark with white words, so the colour itself is also the accent and the outline.
export function shopColorStyle(color: BrandColor | undefined): CSSProperties {
    const brand = color ?? BRAND_COLORS[0]

    return {
        "--shop-bg": brand.background,
        "--shop-fg": brand.text,
        "--shop-tint": brand.tint,
        "--shop-accent": brand.background,
        "--shop-edge": brand.background,
        "--shop-line": "rgba(255, 255, 255, 0.25)"
    } as CSSProperties
}

// The first paragraph of the "about" text, for the top of the page. The rest shows in About.
export function firstParagraph(about: string | null | undefined): string {
    return (about ?? "").split(/\n\s*\n|\n/)[0].trim()
}

export type ShopCategory = { name: string, count: number, imageUrl: string | null }

// The categories the shop's products are in, largest first, each with a photo from one of its products.
export function shopCategories(listings: Listing[]): ShopCategory[] {
    const byName = new Map<string, ShopCategory>()

    for (const listing of listings) {
        const entry = byName.get(listing.category) ?? { name: listing.category, count: 0, imageUrl: null }
        entry.count += 1
        entry.imageUrl = entry.imageUrl ?? (listing.imageUrl || null)
        byName.set(listing.category, entry)
    }

    return [...byName.values()].sort((a, b) => b.count - a.count)
}

export function newestFirst(listings: Listing[]): Listing[] {
    return [...listings].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function isRecentlyAdded(listing: Listing, now = Date.now()): boolean {
    const added = Date.parse(listing.createdAt)
    return !Number.isNaN(added) && now - added < NEW_FOR_DAYS * 24 * 60 * 60 * 1000
}

export type DeliveryRate = { state: string, fee: string }

// Where the shop delivers and what it costs, as rows for the delivery panel.
export function deliveryRates(profile: ShopProfile): DeliveryRate[] {
    const rates = profile.shippingRates ?? []
    const fee = (cost: string) => Number(cost) === 0 ? "Free" : formatNaira(cost)
    const rows = rates
        .filter((rate) => rate.cost !== null)
        .map((rate) => ({ state: rate.state, fee: fee(rate.cost as string) }))

    if (profile.deliversEverywhere && rates.length < ALL_STATES.length) {
        rows.push({ state: "Other states", fee: profile.shippingPolicy === "FIXED" && profile.shippingCost ? fee(profile.shippingCost) : "Free" })
    }

    return rows
}

// One line for the bar at the top of the shop, from its delivery settings. Empty when there is nothing to say.
export function deliveryHeadline(profile: ShopProfile): string {
    const rates = profile.shippingRates ?? []

    if (rates.length === 0) {
        if (!profile.shippingPolicy) {
            return ""
        }
        return profile.shippingPolicy === "FIXED" && profile.shippingCost
            ? `Delivery is ${formatNaira(profile.shippingCost)} per order.`
            : "Free delivery on every order."
    }

    const served = rates.filter((rate) => rate.cost !== null)
    const free = served.filter((rate) => Number(rate.cost) === 0)
    const reach = profile.deliversEverywhere
        ? "We deliver to every state."
        : `We deliver to ${served.length} ${served.length === 1 ? "state" : "states"}.`

    if (free.length === 1) {
        return `Free delivery in ${free[0].state}. ${reach}`
    }
    if (free.length > 1) {
        return `Free delivery to ${free.length} states. ${reach}`
    }
    return reach
}

// One line for the product page, for example "Delivery: free in Lagos, from ₦2,500 elsewhere".
export function deliverySummary(profile: ShopProfile): string {
    const rates = profile.shippingRates ?? []

    if (rates.length === 0) {
        return profile.shippingPolicy === "FIXED" && profile.shippingCost
            ? `Delivery: ${formatNaira(profile.shippingCost)} per order`
            : "Free delivery"
    }

    const served = rates.filter((rate) => rate.cost !== null)
    const free = served.filter((rate) => Number(rate.cost) === 0)
    const paid = served.filter((rate) => Number(rate.cost) > 0).map((rate) => Number(rate.cost))
    const lowest = paid.length > 0 ? formatNaira(String(Math.min(...paid))) : null

    if (!lowest) {
        return "Free delivery"
    }
    if (free.length === 1) {
        return `Delivery: free in ${free[0].state}, from ${lowest} elsewhere`
    }
    if (free.length > 1) {
        return `Delivery: free in ${free.length} states, from ${lowest} elsewhere`
    }
    return `Delivery from ${lowest}`
}

export type ShopSocial = { name: string, url: string, handle: string }

export function shopSocials(profile: ShopProfile): ShopSocial[] {
    const social = profile.branding?.social
    if (!social) {
        return []
    }

    return [
        { name: "Instagram", link: social.instagram },
        { name: "TikTok", link: social.tiktok },
        { name: "Facebook", link: social.facebook },
        { name: "X", link: social.x }
    ].flatMap((entry) => entry.link ? [{ name: entry.name, url: entry.link.url, handle: entry.link.handle }] : [])
}

export const NEW_IN_COUNT = 4

export type ShopSection = { id: string, label: string }

// The parts of a shop's home page, for its header and footer links. "New in" only shows when it would
// not just repeat every product; About only when there is something to say.
export function shopSections(profile: ShopProfile, listingCount: number): ShopSection[] {
    const sections: ShopSection[] = []

    if (listingCount > NEW_IN_COUNT) {
        sections.push({ id: "shop-new", label: "New in" })
    }
    sections.push({ id: "shop-all", label: "All products" })
    if ((profile.branding?.about?.trim() ?? "") !== "" || shopSocials(profile).length > 0) {
        sections.push({ id: "shop-about", label: "About" })
    }
    sections.push({ id: "shop-reviews", label: "Reviews" }, { id: "shop-delivery", label: "Delivery" })
    return sections
}

// "We deliver to N states" for the delivery panel, without the free part.
export function deliveryReach(profile: ShopProfile): string {
    const rates = profile.shippingRates ?? []

    if (rates.length === 0) {
        return "The fee is added at checkout."
    }

    const served = rates.filter((rate) => rate.cost !== null).length
    const reach = profile.deliversEverywhere ? "Every state" : `${served} ${served === 1 ? "state" : "states"}`
    return `${reach}. The fee is added at checkout once you pick your state.`
}
