import { useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import AuthShell from "../components/AuthShell"
import Notice from "../components/Notice"
import { checkPassword, requestPasswordReset, resetPassword } from "../lib/accountApi"
import { useCooldown } from "../lib/useCooldown"
import { useDocumentTitle } from "../lib/useDocumentTitle"

const RESEND_WAIT_SECONDS = 60
const CODE_LENGTH = 6

// Step 1 asks for the email; step 2 takes the emailed code and the new password. The answer to
// step 1 is the same for every address, so this page never says whether an account exists.
function ForgotPasswordPage() {
    useDocumentTitle("Reset your password")
    const navigate = useNavigate()
    const passwordHintId = useId()
    const [email, setEmail] = useState("")
    const [step, setStep] = useState<"email" | "reset">("email")
    const [code, setCode] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const { remaining, restart } = useCooldown(RESEND_WAIT_SECONDS)

    async function handleRequestCode(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isWorking) {
            return
        }

        if (email.trim() === "") {
            setError("Enter your email address.")
            return
        }

        setIsWorking(true)
        setError("")
        const outcome = await requestPasswordReset(email.trim())
        setIsWorking(false)

        if (outcome.kind === "ok") {
            setNotice(outcome.message)
            restart()
            setStep("reset")
        } else {
            setError(outcome.message)
        }
    }

    async function handleResend() {
        if (remaining > 0 || isWorking) {
            return
        }

        setIsWorking(true)
        setError("")
        const outcome = await requestPasswordReset(email.trim())
        setIsWorking(false)

        if (outcome.kind === "ok") {
            setNotice(outcome.message)
            restart()
        } else {
            setError(outcome.message)
        }
    }

    async function handleReset(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isWorking || code.length !== CODE_LENGTH) {
            return
        }

        const problem = checkPassword(newPassword)
        if (problem) {
            setError(problem)
            return
        }

        setIsWorking(true)
        setError("")
        const outcome = await resetPassword(email.trim(), code, newPassword)
        setIsWorking(false)

        if (outcome.kind === "ok") {
            // Every login of the account has ended and nobody is logged in, so the person logs in again.
            navigate("/login", { replace: true, state: { passwordReset: true } })
        } else {
            setError(outcome.message)
        }
    }

    if (step === "email") {
        return (
            <AuthShell title="Reset your password">
                <form onSubmit={handleRequestCode} className="card form-card stack-form">
                    <p>Enter the email address of your account and we will send you a code to set a new password.</p>
                    <label>
                        Email
                        <input name="email" type="email" autoComplete="email" maxLength={254} value={email} disabled={isWorking} autoFocus onChange={(event) => setEmail(event.target.value)} />
                    </label>
                    {error && <Notice kind="error">{error}</Notice>}
                    <button type="submit" className="btn-block btn-lg" disabled={isWorking}>{isWorking ? "Sending..." : "Send the code"}</button>
                </form>
                <p className="form-footer"><Link to="/login">Back to log in</Link></p>
            </AuthShell>
        )
    }

    return (
        <AuthShell title="Choose a new password">
            <form onSubmit={handleReset} className="card form-card stack-form">
                {notice && <Notice kind="info">{notice}</Notice>}
                <p>Enter the 6-digit code we emailed to <strong>{email.trim()}</strong>, then your new password. The code expires in 10 minutes.</p>
                <label>
                    Code
                    <input
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={CODE_LENGTH}
                        value={code}
                        disabled={isWorking}
                        autoFocus
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    />
                </label>
                <label>
                    New password
                    <input
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        aria-describedby={passwordHintId}
                        value={newPassword}
                        disabled={isWorking}
                        onChange={(event) => setNewPassword(event.target.value)}
                    />
                </label>
                <p id={passwordHintId} className="field-help">At least 10 characters. Avoid common passwords. Changing your password logs you out everywhere.</p>
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn-block btn-lg" disabled={isWorking || code.length !== CODE_LENGTH || newPassword === ""}>
                    {isWorking ? "Saving..." : "Change password"}
                </button>
                <div className="code-actions">
                    <button type="button" className="btn-text" disabled={remaining > 0 || isWorking} onClick={handleResend}>
                        {remaining > 0 ? `Send a new code in ${remaining}s` : "Send a new code"}
                    </button>
                    <button type="button" className="btn-text" disabled={isWorking} onClick={() => { setStep("email"); setCode(""); setNewPassword(""); setError(""); setNotice("") }}>
                        Use a different email
                    </button>
                </div>
            </form>
        </AuthShell>
    )
}

export default ForgotPasswordPage
