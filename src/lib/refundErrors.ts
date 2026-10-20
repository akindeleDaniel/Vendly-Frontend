import { isRecord, failureMessage } from "./apiRequest"
import type { ApiResult } from "./apiRequest"
import { formatNaira } from "./money"

export type RefundFailure = {
    message: string
    // Set when Vendly's balance with the provider is too low: the administrator can send the
    // request again to queue the refund anyway.
    lowBalance: boolean
    // Set when the provider could not be reached: the refund may or may not exist, so it must not
    // be issued again. The administrator checks the refunds list instead.
    unknownReference: string | null
}

function readMoney(value: unknown): string | null {
    return typeof value === "string" || typeof value === "number" ? formatNaira(String(value)) : null
}

// Turns a failed refund request into a message and the follow-up the administrator can take.
export function readRefundFailure(result: Exclude<ApiResult<unknown>, { kind: "ok" }>): RefundFailure {
    if (result.kind !== "failed") {
        return { message: failureMessage(result), lowBalance: false, unknownReference: null }
    }

    const body = isRecord(result.body) ? result.body : {}

    if (result.code === "REFUND_BALANCE_LOW") {
        const available = readMoney(body.availableBalance)
        const required = readMoney(body.required)
        return {
            message: `Vendly's balance with the provider is too low for this refund${available && required ? ` (available ${available}, needed ${required})` : ""}. You can queue it anyway, and it goes out when the balance is topped up.`,
            lowBalance: true,
            unknownReference: null
        }
    }

    if (result.code === "REFUND_PROVIDER_UNAVAILABLE") {
        const reference = typeof body.refundReference === "string" ? body.refundReference : null
        return {
            message: "The payment provider could not be reached, so we do not know whether the refund went through. Do not issue it again: open the refunds list and check this refund.",
            lowBalance: false,
            unknownReference: reference
        }
    }

    if (result.code === "REFUND_AMOUNT_INVALID" && body.maximum !== undefined) {
        const maximum = readMoney(body.maximum)
        return { message: `${result.message}${maximum ? ` The most that can be refunded is ${maximum}.` : ""}`, lowBalance: false, unknownReference: null }
    }

    return { message: result.message, lowBalance: false, unknownReference: null }
}
