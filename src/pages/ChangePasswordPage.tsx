import { useId, useState } from "react"
import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import { changePassword, checkPassword } from "../lib/accountApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"

// Changes the password of the signed-in account. This device stays logged in; every other device
// is logged out by the backend.
function ChangePasswordPage({ backTo }: { backTo: string }) {
    useDocumentTitle("Change your password")
    const hintId = useId()
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSaving) {
            return
        }

        if (currentPassword === "" || newPassword === "") {
            setError("Enter your current password and a new one.")
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

        setIsSaving(true)
        setError("")
        setSuccess("")
        const outcome = await changePassword(currentPassword, newPassword)
        setIsSaving(false)

        if (outcome.kind === "ok") {
            setSuccess("Your password has been changed. You stay logged in here, and every other device has been logged out.")
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
        } else {
            setError(outcome.message)
        }
    }

    return (
        <div className="form-page-wide">
            <p className="page-back"><Link to={backTo} className="back-link">Back</Link></p>
            <h1>Change your password</h1>
            <form onSubmit={handleSubmit} className="card form-card stack-form">
                <label>
                    Current password
                    <input type="password" autoComplete="current-password" value={currentPassword} disabled={isSaving} onChange={(event) => setCurrentPassword(event.target.value)} />
                </label>
                <label>
                    New password
                    <input type="password" autoComplete="new-password" aria-describedby={hintId} value={newPassword} disabled={isSaving} onChange={(event) => setNewPassword(event.target.value)} />
                </label>
                <p id={hintId} className="field-help">At least 10 characters. Avoid common passwords.</p>
                <label>
                    Confirm the new password
                    <input type="password" autoComplete="new-password" value={confirmPassword} disabled={isSaving} onChange={(event) => setConfirmPassword(event.target.value)} />
                </label>
                {success && <Notice kind="success">{success}</Notice>}
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn-block btn-lg" disabled={isSaving}>{isSaving ? "Saving..." : "Change password"}</button>
            </form>
        </div>
    )
}

export default ChangePasswordPage
