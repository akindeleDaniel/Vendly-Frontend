import { useEffect, useRef } from "react"
import CartReminderSwitch from "./CartReminderSwitch"

type LogoutDialogProps = {
    isOpen: boolean
    isWorking: boolean
    error: string
    // False for an account made with Google that has not set a password: the last option then says "Set".
    hasPassword: boolean
    onClose: () => void
    onLogout: () => void
    onLogoutAll: () => void
    onPassword: () => void
    onAccount: () => void
}

// What Logout offers: end the login on this device, or on every device, go to the password page
// (set one, or change it), open "Your data and account", or switch cart reminder emails on or off. It is a real modal dialog, so the keyboard stays inside it and Escape
// closes it.
function LogoutDialog({ isOpen, isWorking, error, hasPassword, onClose, onLogout, onLogoutAll, onPassword, onAccount }: LogoutDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)

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

    return (
        <dialog
            ref={dialogRef}
            className="logout-dialog"
            aria-labelledby="logout-dialog-title"
            onClose={onClose}
            onCancel={(event) => {
                if (isWorking) {
                    event.preventDefault()// do not close while a logout is in progress
                }
            }}
        >
            <div className="logout-dialog-body">
                <h2 id="logout-dialog-title">Your account</h2>

                <div className="logout-option">
                    <button type="button" className="btn btn-primary btn-block" disabled={isWorking} onClick={onLogout}>
                        {isWorking ? "Logging out..." : "Log out"}
                    </button>
                    <p className="field-help">Ends your login on this device only.</p>
                </div>

                <div className="logout-option">
                    <button type="button" className="btn btn-block" disabled={isWorking} onClick={onLogoutAll}>
                        Log out on all devices
                    </button>
                    <p className="field-help">
                        Ends your login on every phone and computer. Use it if a device was lost or someone else may have used your account.
                    </p>
                </div>

                <div className="logout-option logout-option-separated">
                    <button type="button" className="btn btn-block" disabled={isWorking} onClick={onPassword}>
                        {hasPassword ? "Change password" : "Set a password"}
                    </button>
                    <p className="field-help">
                        {hasPassword
                            ? "Choose a new password. This logs you out on your other devices."
                            : "You signed in with Google. Add a password to log in with your email too."}
                    </p>
                </div>

                <div className="logout-option">
                    <button type="button" className="btn btn-block" disabled={isWorking} onClick={onAccount}>
                        Your data and account
                    </button>
                    <p className="field-help">Download a copy of your data, or delete your account.</p>
                </div>

                {isOpen && <CartReminderSwitch />}

                {error && <p role="alert" className="alert alert-error">{error}</p>}

                <button type="button" className="btn-text" disabled={isWorking} onClick={onClose}>Cancel</button>
            </div>
        </dialog>
    )
}

export default LogoutDialog
