import { useId, useState } from "react"
import CodeInput, { CODE_LENGTH } from "./CodeInput"
import { RotateIcon } from "./Icons"
import Notice from "./Notice"
import type { MessageOutcome, VerifyOutcome } from "../lib/accountApi"
import { useCooldown } from "../lib/useCooldown"
import { useRetryAfter } from "../lib/useRetryAfter"
import type { UserRole } from "../types/user"

const RESEND_WAIT_SECONDS = 60

type CodeEntryFormProps = {
    email: string
    // Checks the code. A correct one logs the person in.
    verify: (code: string) => Promise<VerifyOutcome>
    // Asks for a new code.
    resend: () => Promise<MessageOutcome>
    submitLabel: string
    // Shown above the code boxes, for example why a code is needed.
    notice?: string
    // What the way out says: logging in again with a password, or starting over with another email.
    backLabel: string
    onVerified: (role: UserRole) => void
    onBack: () => void
}

// Asks for the 6-digit code that was just emailed. A correct code logs the person in. The backend
// sends nothing if a new code is asked for within a minute, so the resend button waits 60 seconds.
function CodeEntryForm({ email, verify, resend, submitLabel, notice, backLabel, onVerified, onBack }: CodeEntryFormProps) {
    const helpId = useId()
    const [code, setCode] = useState("")
    const [isChecking, setIsChecking] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [error, setError] = useState("")
    const [resendMessage, setResendMessage] = useState("")
    const { remaining, restart } = useCooldown(RESEND_WAIT_SECONDS)// a code was only just sent
    const wait = useRetryAfter()

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isChecking || code.length !== CODE_LENGTH) {
            return
        }

        setIsChecking(true)
        setError("")
        setResendMessage("")
        const outcome = await verify(code)
        setIsChecking(false)

        if (outcome.kind === "ok") {
            onVerified(outcome.role)
        } else {
            setError(outcome.message)
            wait.block(outcome.retryAfterSeconds)
            setCode("")
        }
    }

    async function handleResend() {
        if (remaining > 0 || isResending) {
            return
        }

        setIsResending(true)
        setError("")
        setResendMessage("")
        const outcome = await resend()
        setIsResending(false)

        if (outcome.kind === "ok") {
            setResendMessage(outcome.message)
            setCode("")
            restart()
        } else {
            setError(outcome.message)
            wait.block(outcome.retryAfterSeconds)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="auth-form code-form">
            {notice && <Notice kind="info">{notice}</Notice>}
            <p id={helpId} className="code-intro">
                We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes. Check your spam folder if you can't see it.
            </p>
            <CodeInput value={code} onChange={setCode} disabled={isChecking} invalid={error !== ""} describedBy={helpId} />
            {error && <Notice kind="error">{error}</Notice>}
            {resendMessage && <Notice kind="success">{resendMessage}</Notice>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={isChecking || code.length !== CODE_LENGTH || wait.remaining > 0}>
                {wait.remaining > 0 ? `Try again in ${wait.remaining}s` : isChecking ? "Checking..." : submitLabel}
            </button>
            <div className="code-actions">
                <button type="button" className="btn-text icon-text-button" disabled={remaining > 0 || isResending || isChecking || wait.remaining > 0} onClick={handleResend}>
                    <RotateIcon size={18} />
                    {remaining > 0 ? `Resend code in ${remaining}s` : isResending ? "Sending..." : "Resend code"}
                </button>
                <button type="button" className="btn-text" disabled={isChecking} onClick={onBack}>{backLabel}</button>
            </div>
        </form>
    )
}

export default CodeEntryForm
