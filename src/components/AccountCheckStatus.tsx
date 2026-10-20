import Notice from "./Notice"
import type { AccountCheck } from "../lib/useAccountCheck"

// What the account check found: the holder's name to confirm, or why it could not be confirmed.
function AccountCheckStatus({ check, id }: { check: AccountCheck, id: string }) {
    const { isChecking, result } = check

    return (
        <div id={id} className="field-status">
            {isChecking && <p role="status" className="field-help">Checking the account...</p>}
            {result?.kind === "found" && (
                <Notice kind="success">
                    <p>Account name: <strong>{result.accountName}</strong></p>
                    <p>Check that this is your account before you continue.</p>
                </Notice>
            )}
            {result?.kind === "invalid" && (
                <Notice kind="error">We could not find an account with those details. Check the bank and account number.</Notice>
            )}
            {result?.kind === "unavailable" && (
                <Notice kind="warning">
                    <p>We could not check the account right now.</p>
                    <button type="button" onClick={check.retry}>Try again</button>
                </Notice>
            )}
            {result?.kind === "error" && <Notice kind="error">{result.message}</Notice>}
        </div>
    )
}

export default AccountCheckStatus
