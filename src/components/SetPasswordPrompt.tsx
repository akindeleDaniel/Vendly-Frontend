import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { markPasswordPromptDismissed, readPasswordPromptDismissed } from "../lib/passwordPrompt"
import type { AuthStatus } from "../types/user"

type SetPasswordPromptProps = {
    authStatus: AuthStatus
    hasPassword: boolean
}

// A one-time pop-up for an account made with Google, which has no password: it explains why one is
// worth adding and offers to do it now. "Maybe later" closes it, and it stays closed until the next
// login. The set-password page itself is reachable any time from the Logout dialog.
function SetPasswordPrompt({ authStatus, hasPassword }: SetPasswordPromptProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const [isDismissed, setIsDismissed] = useState(readPasswordPromptDismissed)
    const isOpen = authStatus === "authenticated" && !hasPassword && !isDismissed && pathname !== "/change-password"

    useEffect(() => {
        const dialog = dialogRef.current

        if (!dialog) {
            return
        }

        if (isOpen && !dialog.open) {
            dialog.showModal()
        } else if (!isOpen && dialog.open) {
            dialog.close()
        }
    }, [isOpen])

    function dismiss() {
        markPasswordPromptDismissed()
        setIsDismissed(true)
    }

    function setPasswordNow() {
        dismiss()
        navigate("/change-password")
    }

    return (
        <dialog ref={dialogRef} className="logout-dialog" aria-labelledby="password-prompt-title" onClose={dismiss}>
            <div className="logout-dialog-body">
                <h2 id="password-prompt-title">Add a password to your account</h2>
                <p>
                    You signed in with Google, so your account has no password yet. A password lets you log in with your email too, and you need one to change your payout bank account.
                </p>
                <p className="field-help">It takes a minute. We will email you a code to confirm it is you.</p>
                <button type="button" className="btn btn-primary btn-block" onClick={setPasswordNow}>Set a password</button>
                <button type="button" className="btn-text" onClick={dismiss}>Maybe later</button>
            </div>
        </dialog>
    )
}

export default SetPasswordPrompt
