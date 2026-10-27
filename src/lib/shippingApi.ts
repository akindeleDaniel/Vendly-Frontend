import { states } from "nigerian-states-and-lgas"
import { apiRequest, isRecord } from "./apiRequest"
import type { ApiResult } from "./apiRequest"

// Where a seller delivers and what it costs (GET and PUT /seller/shipping-rates). A rate's `cost` is a
// naira string, or null for "no delivery to this state". With `deliversEverywhere`, a state that is not
// listed uses the shop's default fee (`shippingPolicy` and `shippingCost`).
export type ShippingRates = {
    shippingPolicy: "FREE" | "FIXED"
    shippingCost: string | null
    deliversEverywhere: boolean
    rates: Array<{ state: string, cost: string | null }>
}

// The 37 states, from the same list the backend checks against.
export const ALL_STATES: string[] = states()

function isShippingRates(value: unknown): value is ShippingRates {
    return isRecord(value) && Array.isArray(value.rates) && typeof value.deliversEverywhere === "boolean"
}

export function fetchShippingRates(signal?: AbortSignal): Promise<ApiResult<ShippingRates>> {
    return apiRequest<ShippingRates>("/seller/shipping-rates", { signal, isValid: isShippingRates })
}

// The page's choices, as the seller sees them: free or paid, all states or a chosen few, and a price per state.
export type DeliveryChoices = {
    isFree: boolean
    everywhere: boolean
    chosen: string[]
    prices: Record<string, string>
}

export function choicesFromRates(saved: ShippingRates): DeliveryChoices {
    const listed = new Map(saved.rates.map((rate) => [rate.state, rate.cost]))
    const defaultCost = saved.shippingPolicy === "FIXED" ? saved.shippingCost ?? "" : "0"
    const chosen = saved.deliversEverywhere
        ? ALL_STATES.filter((state) => listed.get(state) !== null)
        : saved.rates.filter((rate) => rate.cost !== null).map((rate) => rate.state)
    const prices: Record<string, string> = {}

    for (const state of chosen) {
        const cost = listed.get(state)
        prices[state] = cost === undefined || cost === null ? defaultCost : cost
    }

    const isFree = saved.shippingPolicy === "FREE" && chosen.every((state) => Number(prices[state] || 0) === 0)

    return { isFree, everywhere: chosen.length === ALL_STATES.length, chosen, prices }
}

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

// What is wrong with the choices, or null when they can be saved.
export function checkDeliveryChoices(choices: DeliveryChoices): string | null {
    if (choices.chosen.length === 0) {
        return "Pick at least one state you deliver to."
    }

    if (!choices.isFree) {
        const missing = choices.chosen.find((state) => !PRICE_PATTERN.test((choices.prices[state] ?? "").trim()))
        if (missing) {
            return `Enter a delivery price for ${missing} (0 or more, with at most two decimal places).`
        }
    }

    return null
}

// Saves the choices: the default fee on the profile, then the full list of states. Returns an error to show,
// or null when both were saved.
export async function saveDeliveryChoices(choices: DeliveryChoices): Promise<string | null> {
    const priceOf = (state: string) => choices.isFree ? "0" : choices.prices[state].trim()
    const lowest = choices.isFree ? null : choices.chosen.map((state) => Number(priceOf(state))).reduce((a, b) => Math.min(a, b))

    const profile = await apiRequest<unknown>("/seller/profile", {
        method: "PATCH",
        body: lowest === null || lowest === 0
            ? { shippingPolicy: "FREE" }
            : { shippingPolicy: "FIXED", shippingCost: lowest.toFixed(2) }
    })

    if (profile.kind !== "ok") {
        return profile.kind === "failed" ? profile.message : "We could not save your delivery settings. Please try again."
    }

    // Every chosen state is listed with its own price, so the default only matters for the shop's summary.
    const everywhereAndFree = choices.everywhere && choices.isFree
    const rates = await apiRequest<ShippingRates>("/seller/shipping-rates", {
        method: "PUT",
        body: {
            deliversEverywhere: choices.everywhere,
            rates: everywhereAndFree ? [] : choices.chosen.map((state) => ({ state, cost: priceOf(state) }))
        },
        isValid: isShippingRates
    })

    if (rates.kind !== "ok") {
        return rates.kind === "failed" ? rates.message : "We could not save your delivery settings. Please try again."
    }

    return null
}
