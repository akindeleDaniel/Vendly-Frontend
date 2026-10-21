import { useId, useState } from "react"
import { Link } from "react-router-dom"
import CodeInput, { CODE_LENGTH } from "../components/CodeInput"
import Notice from "../components/Notice"
import { checkPassword, sendSetPasswordCode, setPassword } from "../lib/accountApi"
import { useCooldown } from "../lib/useCooldown"
import { useDocumentTitle } from "../lib/useDocumentTitle"

const RESEND_WAIT_SECONDS = 60

type SetPasswordPageProps = {
    backTo: string
    // Called once the password is set, so the rest of the app knows the account now has one.
    onPasswordSet: () => void
}

// For an account made with Google, which has no password yet. A code is emailed first, so that only
// the owner of the mailbox can add one. A password is needed to change the payout bank account.
function SetPasswordPage({ backTo, onPasswordSet }: SetPasswordPageProps) {
    useDocumentTitle("Set a password")
    const hintId = useId()
    const [step, setStep] = useState<"start" | "enter" | "done">("start")
    const [code, setCode] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const { remaining, restart } = useCooldown(RESEND_WAIT_SECONDS)

    async function requestCode() {
        if (isWorking) {
            return
        }

        setIsWorking(true)
        setError("")
        const outcome = await sendSetPasswordCode()
        setIsWorking(false)

        if (outcome.kind === "ok") {
            setNotice(outcome.message)
            restart()
            setStep("enter")
        } else {
            setError(outcome.message)
        }
    }

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isWorking || code.length !== CODE_LENGTH) {
            return
        }

        const problem = checkPassword(newPassword)
        if (problem) {
            setError(problem)
            return
        }

        if (newPassword !== confirmPassword) {
            setError("The new password and its confirmation do not match.")
            return
        }

        setIsWorking(true)
        setError("")
        const outcome = await setPassword(code, newPassword)
        setIsWorking(false)

        if (outcome.kind === "ok") {
            setStep("done")
            onPasswordSet()
        } else {
            setError(outcome.message)
        }
    }

    const back = <p className="page-back"><Link to={backTo} className="back-link">Back</Link></p>

    if (step === "done") {
        return (
            <div className="form-page-wide">
                {back}
                <h1>Password set</h1>
                <Notice kind="success">
                    Your password has been set. You stay logged in here, and every other device has been logged out. You can now also log in with your email and password, and change your payout bank account.
                </Notice>
            </div>
        )
    }

    return (
        <div className="form-page-wide">
            {back}
            <h1>Set a password</h1>
            <section className="card form-card">
                {step === "start" ? (
                    <div className="stack-form">
                        <p>
                            You signed up with Google, so your account has no password. Adding one lets you log in with your email, and is needed to change your payout bank account. We will email you a code first to confirm it is you.
                        </p>
                        {error && <Notice kind="error">{error}</Notice>}
                        <button type="button" className="btn-block btn-lg" disabled={isWorking} onClick={requestCode}>
                            {isWorking ? "Sending..." : "Email me a code"}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="stack-form code-form">
                        {notice && <Notice kind="info">{notice}</Notice>}
                        <p>Enter the 6-digit code we emailed you, then choose your password.</p>
                        <CodeInput value={code} onChange={setCode} disabled={isWorking} invalid={error !== ""} />
                        <label>
                            New password
                            <input type="password" autoComplete="new-password" aria-describedby={hintId} value={newPassword} disabled={isWorking} onChange={(event) => setNewPassword(event.target.value)} />
                        </label>
                        <p id={hintId} className="field-help">At least 10 characters. Avoid common passwords. Setting a password logs you out on your other devices.</p>
                        <label>
                            Confirm the new password
                            <input type="password" autoComplete="new-password" value={confirmPassword} disabled={isWorking} onChange={(event) => setConfirmPassword(event.target.value)} />
                        </label>
                        {error && <Notice kind="error">{error}</Notice>}
                        <button type="submit" className="btn-block btn-lg" disabled={isWorking || code.length !== CODE_LENGTH || newPassword === ""}>
                            {isWorking ? "Saving..." : "Set password"}
                        </button>
                        <div className="code-actions">
                            <button type="button" className="btn-text" disabled={remaining > 0 || isWorking} onClick={requestCode}>
                                {remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    )
}

export default SetPasswordPage
