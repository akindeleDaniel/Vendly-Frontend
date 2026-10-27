import { lgas } from "nigerian-states-and-lgas"
import { apiFetch } from "./api"
import type {
    CheckoutResult,
    CheckoutReview,
    DeliveryDetails,
    LockedCheckout
} from "../types/checkout"

// The backend answers an empty cart with a 400 that has a message but no code.
const EMPTY_CART_MESSAGE = "Cart is empty"
const UNEXPECTED_RESPONSE_MESSAGE = "We received an unexpected response from the server. Please try again."

// One shop's order is above the order limit. The amounts are naira strings from the backend, null when missing.
export type OrderTooLarge = { kind: "order-too-large", sellerName: string | null, orderTotal: string | null, limit: string | null }

export type PreviewOutcome =
    | { kind: "ok", review: CheckoutReview }
    | OrderTooLarge
    | { kind: "empty-cart" }
    | { kind: "items-unavailable", message: string, listingId: number | null }
    | { kind: "conflict", message: string }
    | { kind: "unauthorized" }
    | { kind: "network-error" }
    | { kind: "error", message: string }

export type SubmitOutcome =
    | { kind: "success", result: CheckoutResult }
    | { kind: "review-required", message: string, review: CheckoutReview }
    | { kind: "items-unavailable", message: string, listingId: number | null }
    | { kind: "locked", message: string, checkout: LockedCheckout | null }
    | { kind: "conflict", message: string }
    | { kind: "preorder-problem", message: string }
    | OrderTooLarge// a food shop's pre-order is needed, has lapsed, or no longer matches
    | { kind: "empty-cart" }
    | { kind: "invalid-request", message: string }
    | { kind: "unauthorized" }
    | { kind: "unconfirmed" }// the request may or may not have reached the server
    | { kind: "error", message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isReview(value: unknown): value is CheckoutReview {
    if (!isRecord(value) || typeof value.reviewToken !== "string" || !Array.isArray(value.sellers)) {
        return false
    }

    return (
        typeof value.subtotal === "string" &&
        typeof value.shipping === "string" &&
        typeof value.total === "string" &&
        value.sellers.every((group) =>
            isRecord(group) &&
            isRecord(group.seller) &&
            typeof group.seller.businessName === "string" &&
            typeof group.seller.slug === "string" &&
            typeof group.subtotal === "string" &&
            typeof group.shipping === "string" &&
            typeof group.total === "string" &&
            Array.isArray(group.items) &&
            group.items.every((item) =>
                isRecord(item) &&
                Number.isInteger(item.listingId) &&
                typeof item.title === "string" &&
                typeof item.unitPrice === "string" &&
                Number.isInteger(item.quantity) &&
                typeof item.lineSubtotal === "string"
            )
        )
    )
}

const successCodes = ["CHECKOUT_CREATED", "CHECKOUT_REPLACED", "CHECKOUT_REUSED"]

function isCheckoutResult(value: unknown): value is CheckoutResult {
    if (
        !isRecord(value) ||
        typeof value.code !== "string" ||
        !successCodes.includes(value.code) ||
        !isRecord(value.checkout) ||
        !Number.isInteger(value.checkout.id) ||
        typeof value.checkout.status !== "string" ||
        typeof value.checkout.expiresAt !== "string" ||
        typeof value.subtotal !== "string" ||
        typeof value.shipping !== "string" ||
        typeof value.total !== "string" ||
        !Array.isArray(value.orders)
    ) {
        return false
    }

    return value.orders.every((order) =>
        isRecord(order) &&
        Number.isInteger(order.id) &&
        typeof order.status === "string" &&
        typeof order.subtotal === "string" &&
        typeof order.shipping === "string" &&
        typeof order.total === "string" &&
        Array.isArray(order.items)
    )
}

function isLockedCheckout(value: unknown): value is LockedCheckout {
    return (
        isRecord(value) &&
        Number.isInteger(value.id) &&
        typeof value.status === "string" &&
        typeof value.expiresAt === "string"
    )
}

// The backend sends JSON, except that the authentication middleware can send plain text.
async function readBody(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => "")

    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function messageOf(body: unknown, fallback: string): string {
    if (isRecord(body) && typeof body.message === "string" && body.message) {
        return body.message
    }

    if (typeof body === "string" && body && body.length <= 200 && !body.trim().startsWith("<")) {
        return body
    }

    return fallback
}

function codeOf(body: unknown): string | null {
    return isRecord(body) && typeof body.code === "string" ? body.code : null
}

// The shop, its order total and the limit from an "order too large" answer.
function orderTooLargeOf(body: unknown): OrderTooLarge {
    const text = (key: string) => isRecord(body) && typeof body[key] === "string" ? body[key] as string : null

    return {
        kind: "order-too-large",
        sellerName: isRecord(body) && isRecord(body.seller) && typeof body.seller.businessName === "string" ? body.seller.businessName : null,
        orderTotal: text("orderTotal"),
        limit: text("limit")
    }
}

const ORDER_TOO_LARGE_CODE = "CHECKOUT_ORDER_TOO_LARGE"

function listingIdOf(body: unknown): number | null {
    return isRecord(body) && Number.isInteger(body.listingId) ? body.listingId as number : null
}

export async function fetchCheckoutPreview(signal?: AbortSignal): Promise<PreviewOutcome> {
    let response: Response

    try {
        response = await apiFetch("/checkout/preview", {
            credentials: "include",
            signal
        })
    } catch {
        return { kind: "network-error" }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    const body = await readBody(response)

    if (response.ok) {
        return isReview(body)
            ? { kind: "ok", review: body }
            : { kind: "error", message: UNEXPECTED_RESPONSE_MESSAGE }
    }

    const message = messageOf(body, `Unable to load checkout (status ${response.status}).`)

    if (response.status === 400 && message === EMPTY_CART_MESSAGE) {
        return { kind: "empty-cart" }
    }

    if (response.status === 409 && codeOf(body) === "CHECKOUT_ITEMS_UNAVAILABLE") {
        return { kind: "items-unavailable", message, listingId: listingIdOf(body) }
    }

    if (response.status === 409 && codeOf(body) === "CHECKOUT_CONFLICT") {
        return { kind: "conflict", message }
    }

    if (response.status === 409 && codeOf(body) === ORDER_TOO_LARGE_CODE) {
        return orderTooLargeOf(body)
    }

    return { kind: "error", message }
}

export type DeliveryValidationError = {
    field: keyof DeliveryDetails
    message: string
}

// Returns the first invalid delivery field with a message, or null. This mirrors the backend:
// name, phone and address must not be blank, and the LGA must belong to the state. The phone has
// no format rule because the backend has none.
export function validateDelivery(delivery: DeliveryDetails): DeliveryValidationError | null {
    if (delivery.fullName.trim() === "") {
        return { field: "fullName", message: "Please enter your full name." }
    }

    if (delivery.phone.trim() === "") {
        return { field: "phone", message: "Please enter a phone number." }
    }

    if (delivery.address.trim() === "") {
        return { field: "address", message: "Please enter your delivery address." }
    }

    if (delivery.state === "") {
        return { field: "state", message: "Please select a state." }
    }

    if (delivery.lga === "") {
        return { field: "lga", message: "Please select a local government area." }
    }

    if (!lgas(delivery.state)?.includes(delivery.lga)) {
        return { field: "lga", message: "The selected local government area does not belong to the selected state." }
    }

    return null
}

// The backend rejects unknown fields, so only the fields it documents are sent.
function buildDeliveryBody(delivery: DeliveryDetails) {
    const instructions = delivery.instructions.trim()

    return {
        fullName: delivery.fullName.trim(),
        phone: delivery.phone.trim(),
        address: delivery.address.trim(),
        state: delivery.state,
        lga: delivery.lga,
        ...(instructions ? { instructions } : {})
    }
}

export async function submitCheckout(delivery: DeliveryDetails, reviewToken: string, preOrderIds: number[] = []): Promise<SubmitOutcome> {
    let response: Response

    try {
        response = await apiFetch("/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                delivery: buildDeliveryBody(delivery),
                reviewToken,
                ...(preOrderIds.length > 0 ? { preOrderIds } : {})
            })
        })
    } catch {
        return { kind: "unconfirmed" }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    const body = await readBody(response)

    if (response.ok) {
        // A success status whose body cannot be read leaves the outcome unconfirmed from the shopper's side.
        return isCheckoutResult(body)
            ? { kind: "success", result: body }
            : { kind: "unconfirmed" }
    }

    const message = messageOf(body, `Unable to create your checkout (status ${response.status}).`)

    if (response.status === 400) {
        return message === EMPTY_CART_MESSAGE
            ? { kind: "empty-cart" }
            : { kind: "invalid-request", message }
    }

    if (response.status === 409) {
        const code = codeOf(body)

        if (code === "CHECKOUT_REVIEW_REQUIRED" && isRecord(body) && isReview(body.review)) {
            return { kind: "review-required", message, review: body.review }
        }

        if (code === "CHECKOUT_ITEMS_UNAVAILABLE") {
            return { kind: "items-unavailable", message, listingId: listingIdOf(body) }
        }

        if (code === "CHECKOUT_LOCKED") {
            return {
                kind: "locked",
                message,
                checkout: isRecord(body) && isLockedCheckout(body.checkout) ? body.checkout : null
            }
        }

        if (code === "CHECKOUT_CONFLICT") {
            return { kind: "conflict", message }
        }

        if (code === ORDER_TOO_LARGE_CODE) {
            return orderTooLargeOf(body)
        }

        if (code === "CHECKOUT_PREORDER_REQUIRED" || code === "CHECKOUT_PREORDER_INVALID" || code === "CHECKOUT_PREORDER_NOT_AVAILABLE") {
            return { kind: "preorder-problem", message }
        }
    }

    return { kind: "error", message }
}
