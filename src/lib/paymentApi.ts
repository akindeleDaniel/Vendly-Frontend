import { apiFetch } from "./api"
import type { Payment, PaymentProvider } from "../types/payment"

const UNEXPECTED_RESPONSE_MESSAGE = "We received an unexpected response from the server. Please try again."

export type StartPaymentOutcome =
    | { kind: "redirect", payment: Payment }// go to the provider's payment page
    | { kind: "already-paid", message: string }
    | { kind: "expired", message: string }
    | { kind: "sellers-not-ready", message: string, sellers: string[] }
    | { kind: "try-again", message: string }// still starting, provider unreachable, or a conflict
    | { kind: "unauthorized" }
    | { kind: "unconfirmed" }// the request may or may not have reached the server
    | { kind: "error", message: string }

export type FetchPaymentOutcome =
    | { kind: "ok", payment: Payment }
    | { kind: "not-found" }
    | { kind: "unauthorized" }
    | { kind: "network-error" }
    | { kind: "error", message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPayment(value: unknown): value is Payment {
    return (
        isRecord(value) &&
        typeof value.reference === "string" &&
        (value.provider === "PAYSTACK" || value.provider === "FLUTTERWAVE") &&
        (value.status === "PENDING" || value.status === "SUCCESS" || value.status === "FAILED") &&
        typeof value.amount === "string" &&
        typeof value.currency === "string" &&
        (value.authorizationUrl === null || typeof value.authorizationUrl === "string") &&
        (value.failureReason === null || typeof value.failureReason === "string") &&
        isRecord(value.checkout) &&
        Number.isInteger(value.checkout.id) &&
        typeof value.checkout.status === "string" &&
        typeof value.checkout.expiresAt === "string"
    )
}

async function readBody(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => "")

    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function messageOf(body: unknown, fallback: string): string {
    return isRecord(body) && typeof body.message === "string" && body.message ? body.message : fallback
}

function codeOf(body: unknown): string | null {
    return isRecord(body) && typeof body.code === "string" ? body.code : null
}

// Starts payment for a checkout, or returns the payment already in progress for it.
export async function startPayment(checkoutId: number, provider: PaymentProvider): Promise<StartPaymentOutcome> {
    let response: Response

    try {
        response = await apiFetch(`/checkout/${checkoutId}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ provider })
        })
    } catch {
        return { kind: "unconfirmed" }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    const body = await readBody(response)

    if (response.ok) {
        const payment = isRecord(body) ? body.payment : null

        if (isPayment(payment) && payment.status === "PENDING" && payment.authorizationUrl) {
            return { kind: "redirect", payment }
        }

        return { kind: "error", message: UNEXPECTED_RESPONSE_MESSAGE }
    }

    const message = messageOf(body, `Unable to start payment (status ${response.status}).`)

    switch (codeOf(body)) {
        case "PAYMENT_ALREADY_COMPLETED":
            return { kind: "already-paid", message }
        case "CHECKOUT_EXPIRED":
            return { kind: "expired", message }
        case "PAYMENT_SELLER_NOT_READY": {
            const sellers = isRecord(body) && Array.isArray(body.sellers)
                ? body.sellers.filter((seller): seller is string => typeof seller === "string")
                : []
            return { kind: "sellers-not-ready", message, sellers }
        }
        case "PAYMENT_INITIALIZING":
        case "PAYMENT_PROVIDER_UNAVAILABLE":
        case "PAYMENT_PROVIDER_REJECTED":
        case "PAYMENT_CONFLICT":
        case "PAYMENT_IN_PROGRESS":
            return { kind: "try-again", message }
        default:
            return { kind: "error", message }
    }
}

// Reads a payment's authoritative status. The backend checks with the provider first.
export async function fetchPayment(reference: string, signal?: AbortSignal): Promise<FetchPaymentOutcome> {
    let response: Response

    try {
        response = await apiFetch(`/payments/${encodeURIComponent(reference)}`, { credentials: "include", signal })
    } catch {
        return { kind: "network-error" }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    if (response.status === 404) {
        return { kind: "not-found" }
    }

    const body = await readBody(response)

    if (response.ok) {
        const payment = isRecord(body) ? body.payment : null
        return isPayment(payment) ? { kind: "ok", payment } : { kind: "error", message: UNEXPECTED_RESPONSE_MESSAGE }
    }

    return { kind: "error", message: messageOf(body, `Unable to check your payment (status ${response.status}).`) }
}
