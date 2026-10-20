import { useId, useState } from "react"
import AccountCheckStatus from "./AccountCheckStatus"
import BankPicker from "./BankPicker"
import Notice from "./Notice"
import { changePayoutAccount } from "../lib/payoutApi"
import { useAccountCheck } from "../lib/useAccountCheck"
import type { PayoutAccount, PayoutBank } from "../types/payout"

type ChangeBankAccountFormProps = {
    banks: PayoutBank[]
    // Called with the updated accounts when the change worked or partly worked.
    onChanged: (accounts: PayoutAccount[], fullyDone: boolean) => void
}

// Moves the seller's payouts to a different bank account. It asks for the account password again,
// because changing where money goes is what someone with a stolen session would try.
function ChangeBankAccountForm({ banks, onChanged }: ChangeBankAccountFormProps) {
    const statusId = useId()
    const passwordId = useId()
    const [bankId, setBankId] = useState("")
    const [accountNumber, setAccountNumber] = useState("")
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")
    const check = useAccountCheck(bankId, accountNumber)

    const canSubmit = check.result?.kind === "found" && password !== "" && !isSubmitting

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!canSubmit) {
            return
        }

        setIsSubmitting(true)
        setError("")
        const outcome = await changePayoutAccount({ bankId, accountNumber, password })
        setIsSubmitting(false)

        switch (outcome.kind) {
            case "success":
                setPassword("")
                setAccountNumber("")
                setBankId("")
                onChanged(outcome.accounts, true)
                break
            case "incomplete":
                setPassword("")
                setError(outcome.message)
                onChanged(outcome.accounts, false)
                break
            case "unauthorized":
                break// the session guard sends the seller to log in
            case "password-incorrect":
                setPassword("")
                setError(outcome.message)
                break
            default:
                setError(outcome.message)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="stack-form">
            <p className="field-help">
                Your payouts will go to the new account from your next sale. Sales already paid are not affected.
            </p>
            <BankPicker banks={banks} value={bankId} onChange={setBankId} disabled={isSubmitting} />
            <label>
                New account number
                <input
                    name="newAccountNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    aria-describedby={statusId}
                    value={accountNumber}
                    disabled={isSubmitting}
                    onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
                />
            </label>
            <AccountCheckStatus check={check} id={statusId} />
            <label>
                Your password
                <input
                    id={passwordId}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    disabled={isSubmitting}
                    onChange={(event) => setPassword(event.target.value)}
                />
            </label>
            {error && <Notice kind="error">{error}</Notice>}
            <button type="submit" className="btn-block btn-lg" disabled={!canSubmit}>
                {isSubmitting ? "Changing..." : "Change bank account"}
            </button>
        </form>
    )
}

export default ChangeBankAccountForm
