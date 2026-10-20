import { useId, useState } from "react"
import Notice from "./Notice"
import { resendCode, verifyCode } from "../lib/accountApi"
import type { CodePurpose } from "../lib/accountApi"
import { useCooldown } from "../lib/useCooldown"
import type { UserRole } from "../types/user"

const RESEND_WAIT_SECONDS = 60
const CODE_LENGTH = 6

type CodeEntryFormProps = {
    email: string
    purpose: CodePurpose
    submitLabel: string
    // Shown above the code box, for example why a code is needed.
    notice?: string
    onVerified: (role: UserRole) => void
    onUseDifferentEmail: () => void
}

// Asks for the 6-digit code that was just emailed. A correct code logs the person in. The backend
// sends nothing if a new code is asked for within a minute, so the button waits 60 seconds.
function CodeEntryForm({ email, purpose, submitLabel, notice, onVerified, onUseDifferentEmail }: CodeEntryFormProps) {
    const helpId = useId()
    const [code, setCode] = useState("")
    const [isChecking, setIsChecking] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [error, setError] = useState("")
    const [resendMessage, setResendMessage] = useState("")
    const { remaining, restart } = useCooldown(RESEND_WAIT_SECONDS)// a code was only just sent

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isChecking || code.length !== CODE_LENGTH) {
            return
        }

        setIsChecking(true)
        setError("")
        setResendMessage("")
        const outcome = await verifyCode(purpose, email, code)
        setIsChecking(false)

        if (outcome.kind === "ok") {
            onVerified(outcome.role)
        } else {
            setError(outcome.message)
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
        const outcome = await resendCode(purpose, email)
        setIsResending(false)

        if (outcome.kind === "ok") {
            setResendMessage(outcome.message)
            restart()
        } else {
            setError(outcome.message)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="card form-card stack-form">
            {notice && <Notice kind="info">{notice}</Notice>}
            <p id={helpId}>
                We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
            </p>
            <label>
                Code
                <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_LENGTH}
                    aria-describedby={helpId}
                    value={code}
                    disabled={isChecking}
                    autoFocus
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />
            </label>
            {error && <Notice kind="error">{error}</Notice>}
            {resendMessage && <Notice kind="success">{resendMessage}</Notice>}
            <button type="submit" className="btn-block btn-lg" disabled={isChecking || code.length !== CODE_LENGTH}>
                {isChecking ? "Checking..." : submitLabel}
            </button>
            <div className="code-actions">
                <button type="button" className="btn-text" disabled={remaining > 0 || isResending || isChecking} onClick={handleResend}>
                    {remaining > 0 ? `Send a new code in ${remaining}s` : isResending ? "Sending..." : "Send a new code"}
                </button>
                <button type="button" className="btn-text" disabled={isChecking} onClick={onUseDifferentEmail}>Use a different email</button>
            </div>
        </form>
    )
}

export default CodeEntryForm
