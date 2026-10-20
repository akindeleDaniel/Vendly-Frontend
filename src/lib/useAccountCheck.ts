import { useEffect, useState } from "react"
import { isAccountNumber, resolvePayoutAccount } from "./payoutApi"

export type AccountCheckResult =
    | { key: string, kind: "found", accountName: string }
    | { key: string, kind: "invalid" }
    | { key: string, kind: "unavailable" }
    | { key: string, kind: "error", message: string }

export type AccountCheck = {
    isChecking: boolean
    result: AccountCheckResult | null
    retry: () => void
}

// Looks up the account holder's name as soon as a bank and a full 10-digit number are entered, and
// again when either changes. A result only counts while it still matches what is typed.
export function useAccountCheck(bankId: string, accountNumber: string): AccountCheck {
    const [latest, setLatest] = useState<AccountCheckResult | null>(null)
    const [attempt, setAttempt] = useState(0)

    const key = bankId !== "" && isAccountNumber(accountNumber)
        ? `${bankId}:${accountNumber}:${attempt}`
        : null

    useEffect(() => {
        if (key === null) {
            return
        }

        const controller = new AbortController()

        resolvePayoutAccount(bankId, accountNumber, controller.signal).then((outcome) => {
            if (controller.signal.aborted || outcome.kind === "unauthorized") {
                return
            }

            if (outcome.kind === "found") {
                setLatest({ key, kind: "found", accountName: outcome.accountName })
            } else if (outcome.kind === "error") {
                setLatest({ key, kind: "error", message: outcome.message })
            } else {
                setLatest({ key, kind: outcome.kind })
            }
        })

        return () => controller.abort()
    }, [key, bankId, accountNumber])

    const result = latest !== null && latest.key === key ? latest : null

    return {
        isChecking: key !== null && result === null,
        result,
        retry: () => setAttempt((count) => count + 1)
    }
}
