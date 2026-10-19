import { apiFetch } from "./api"
import type {
    PayoutAccount,
    PayoutBank,
    PayoutOverview,
    PayoutSetupInput
} from "../types/payout"

const UNEXPECTED_RESPONSE_MESSAGE = "We received an unexpected response from the server. Please try again."
const NETWORK_MESSAGE = "Something went wrong. Please check your connection and try again."

export type LoadOutcome<T> =
    | { kind: "ok", data: T }
    | { kind: "no-store" }// the seller has no store profile yet
    | { kind: "unauthorized" }
    | { kind: "error", message: string }

export type ResolveOutcome =
    | { kind: "found", accountName: string }
    | { kind: "invalid" }// the bank does not recognise the account
    | { kind: "unavailable" }// the check could not run, so trying again may work
    | { kind: "unauthorized" }
    | { kind: "error", message: string }

export type SetupOutcome =
    | { kind: "success", accounts: PayoutAccount[] }
    | { kind: "incomplete", message: string, accounts: PayoutAccount[] }// at least one provider failed
    | { kind: "terms-outdated", message: string }
    | { kind: "already-active", message: string }
    | { kind: "mismatch", message: string }
    | { kind: "in-progress", message: string }
    | { kind: "invalid-account", message: string }
    | { kind: "unauthorized" }
    | { kind: "error", message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPayoutAccount(value: unknown): value is PayoutAccount {
    return (
        isRecord(value) &&
        (value.provider === "PAYSTACK" || value.provider === "FLUTTERWAVE") &&
        (value.status === "PENDING" || value.status === "ACTIVE" || value.status === "FAILED") &&
        typeof value.bankId === "string" &&
        typeof value.bankName === "string" &&
        typeof value.accountName === "string" &&
        typeof value.accountNumberLast4 === "string" &&
        (value.failureReason === null || typeof value.failureReason === "string")
    )
}

function readAccounts(value: unknown): PayoutAccount[] | null {
    return Array.isArray(value) && value.every(isPayoutAccount) ? value : null
}

function isBank(value: unknown): value is PayoutBank {
    return isRecord(value) && typeof value.id === "string" && typeof value.name === "string"
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

export async function fetchPayoutBanks(signal?: AbortSignal): Promise<LoadOutcome<PayoutBank[]>> {
    let response: Response

    try {
        response = await apiFetch("/seller/payout/banks", { credentials: "include", signal })
    } catch {
        return { kind: "error", message: NETWORK_MESSAGE }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    const body = await readBody(response)

    if (!response.ok) {
        return { kind: "error", message: messageOf(body, `Unable to load the bank list (status ${response.status}).`) }
    }

    return Array.isArray(body) && body.every(isBank)
        ? { kind: "ok", data: body }
        : { kind: "error", message: UNEXPECTED_RESPONSE_MESSAGE }
}

export async function fetchPayoutOverview(signal?: AbortSignal): Promise<LoadOutcome<PayoutOverview>> {
    let response: Response

    try {
        response = await apiFetch("/seller/payout/accounts", { credentials: "include", signal })
    } catch {
        return { kind: "error", message: NETWORK_MESSAGE }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    if (response.status === 404) {
        return { kind: "no-store" }
    }

    const body = await readBody(response)

    if (!response.ok) {
        return { kind: "error", message: messageOf(body, `Unable to load your payout details (status ${response.status}).`) }
    }

    const accounts = isRecord(body) ? readAccounts(body.accounts) : null

    if (
        !isRecord(body) ||
        accounts === null ||
        !isRecord(body.feeTerms) ||
        typeof body.feeTerms.version !== "string" ||
        typeof body.feeTerms.text !== "string"
    ) {
        return { kind: "error", message: UNEXPECTED_RESPONSE_MESSAGE }
    }

    return {
        kind: "ok",
        data: {
            feeTerms: { version: body.feeTerms.version, text: body.feeTerms.text },
            feeTermsAcceptedAt: typeof body.feeTermsAcceptedAt === "string" ? body.feeTermsAcceptedAt : null,
            businessPhone: typeof body.businessPhone === "string" ? body.businessPhone : null,
            accounts
        }
    }
}

export async function resolvePayoutAccount(bankId: string, accountNumber: string, signal?: AbortSignal): Promise<ResolveOutcome> {
    let response: Response

    try {
        response = await apiFetch("/seller/payout/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ bankId, accountNumber }),
            signal
        })
    } catch {
        return { kind: "unavailable" }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    const body = await readBody(response)

    if (response.ok) {
        return isRecord(body) && typeof body.accountName === "string" && body.accountName
            ? { kind: "found", accountName: body.accountName }
            : { kind: "error", message: UNEXPECTED_RESPONSE_MESSAGE }
    }

    const code = codeOf(body)

    if (response.status === 400 && code === "PAYOUT_ACCOUNT_INVALID") {
        return { kind: "invalid" }
    }

    if (response.status === 502 && code === "PAYOUT_PROVIDER_UNAVAILABLE") {
        return { kind: "unavailable" }
    }

    return { kind: "error", message: messageOf(body, `Unable to check the account (status ${response.status}).`) }
}

export async function createPayoutAccounts(input: PayoutSetupInput): Promise<SetupOutcome> {
    let response: Response

    try {
        response = await apiFetch("/seller/payout/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                bankId: input.bankId,
                accountNumber: input.accountNumber,
                businessPhone: input.businessPhone,
                acceptFeeTerms: true,
                feeTermsVersion: input.feeTermsVersion
            })
        })
    } catch {
        return { kind: "error", message: NETWORK_MESSAGE }
    }

    if (response.status === 401) {
        return { kind: "unauthorized" }
    }

    const body = await readBody(response)
    const accounts = isRecord(body) ? readAccounts(body.accounts) : null

    if (response.ok) {
        return accounts !== null
            ? { kind: "success", accounts }
            : { kind: "error", message: UNEXPECTED_RESPONSE_MESSAGE }
    }

    const message = messageOf(body, `Unable to set up your payout account (status ${response.status}).`)
    const code = codeOf(body)

    if (response.status === 502 && code === "PAYOUT_SETUP_INCOMPLETE" && accounts !== null) {
        return { kind: "incomplete", message, accounts }
    }

    if (response.status === 400 && code === "PAYOUT_ACCOUNT_INVALID") {
        return { kind: "invalid-account", message }
    }

    if (response.status === 409) {
        if (code === "PAYOUT_FEE_TERMS_OUTDATED") {
            return { kind: "terms-outdated", message }
        }

        if (code === "PAYOUT_ACCOUNTS_ACTIVE") {
            return { kind: "already-active", message }
        }

        if (code === "PAYOUT_ACCOUNT_MISMATCH") {
            return { kind: "mismatch", message }
        }

        if (code === "PAYOUT_SETUP_IN_PROGRESS") {
            return { kind: "in-progress", message }
        }
    }

    return { kind: "error", message }
}

// Mirrors the backend: a Nigerian mobile number as 0XXXXXXXXXX, 234XXXXXXXXXX or +234XXXXXXXXXX,
// with spaces and dashes allowed. Returns the local 11-digit form, or null if it is not valid.
export function normalizeBusinessPhone(value: string): string | null {
    const digits = value.replace(/[\s-]/g, "")
    const match = /^(?:\+?234|0)([789][01]\d{8})$/.exec(digits)

    return match ? `0${match[1]}` : null
}

export function isAccountNumber(value: string): boolean {
    return /^\d{10}$/.test(value)
}

export const PROVIDER_NAMES = {
    PAYSTACK: "Paystack",
    FLUTTERWAVE: "Flutterwave"
} as const
