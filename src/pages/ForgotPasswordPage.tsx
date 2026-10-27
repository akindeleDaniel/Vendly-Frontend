import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { LockKeyhole } from "lucide-react"
import AuthShell from "../components/AuthShell"
import CodeInput, { CODE_LENGTH } from "../components/CodeInput"
import { RotateIcon } from "../components/Icons"
import Notice from "../components/Notice"
import PasswordField from "../components/PasswordField"
import { MIN_PASSWORD_LENGTH, checkPassword, requestPasswordReset, resetPassword } from "../lib/accountApi"
import { useCooldown } from "../lib/useCooldown"
import { useRetryAfter } from "../lib/useRetryAfter"
import { useDocumentTitle } from "../lib/useDocumentTitle"

const RESEND_WAIT_SECONDS = 60

// Step 1 asks for the email; step 2 takes the emailed code and the new password. The answer to
// step 1 is the same for every address, so this page never says whether an account exists.
function ForgotPasswordPage() {
    useDocumentTitle("Reset your password")
    const navigate = useNavigate()
    const [email, setEmail] = useState("")
    const [step, setStep] = useState<"email" | "reset">("email")
    const [code, setCode] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const { remaining, restart } = useCooldown(RESEND_WAIT_SECONDS)
    const wait = useRetryAfter()

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
            wait.block(outcome.retryAfterSeconds)
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
            wait.block(outcome.retryAfterSeconds)
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
            wait.block(outcome.retryAfterSeconds)
        }
    }

    if (step === "email") {
        return (
            <AuthShell
                title="Reset your password"
                lead="Enter your account's email and we'll send you a code to set a new password."
                icon={<LockKeyhole size={30} />}
            >
                <form onSubmit={handleRequestCode} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="reset-email">Email</label>
                        <div className="auth-input">
                            <input
                                id="reset-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                maxLength={254}
                                placeholder="you@example.com"
                                value={email}
                                disabled={isWorking}
                                autoFocus
                                onChange={(event) => setEmail(event.target.value)}
                            />
                        </div>
                    </div>
                    {error && <Notice kind="error">{error}</Notice>}
                    <button type="submit" className="btn btn-primary auth-submit" disabled={isWorking || wait.remaining > 0}>
                        {wait.remaining > 0 ? `Try again in ${wait.remaining}s` : isWorking ? "Sending..." : "Send the code"}
                    </button>
                </form>
                <p className="auth-foot"><Link to="/login">Back to log in</Link></p>
            </AuthShell>
        )
    }

    return (
        <AuthShell title="Choose a new password">
            <form onSubmit={handleReset} className="auth-form">
                {notice && <Notice kind="success">{notice}</Notice>}
                <p className="code-intro">
                    Enter the 6-digit code we emailed to <strong>{email.trim()}</strong>, then your new password. The code expires in 10 minutes.
                </p>
                <div className="auth-field">
                    <span className="auth-label" aria-hidden="true">The code</span>
                    <CodeInput value={code} onChange={setCode} disabled={isWorking} invalid={error !== ""} label="The 6-digit code" />
                </div>
                <PasswordField
                    label="New password"
                    name="newPassword"
                    autoComplete="new-password"
                    value={newPassword}
                    disabled={isWorking}
                    onChange={setNewPassword}
                    minLength={MIN_PASSWORD_LENGTH}
                    note="Changing your password logs you out everywhere."
                />
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn btn-primary auth-submit" disabled={isWorking || code.length !== CODE_LENGTH || newPassword === "" || wait.remaining > 0}>
                    {wait.remaining > 0 ? `Try again in ${wait.remaining}s` : isWorking ? "Saving..." : "Change password"}
                </button>
                <div className="code-actions">
                    <button type="button" className="btn-text icon-text-button" disabled={remaining > 0 || isWorking || wait.remaining > 0} onClick={handleResend}>
                        <RotateIcon size={18} />
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
