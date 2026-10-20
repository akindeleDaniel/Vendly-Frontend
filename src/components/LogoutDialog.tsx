import { useEffect, useRef } from "react"

type LogoutDialogProps = {
    isOpen: boolean
    isWorking: boolean
    error: string
    onClose: () => void
    onLogout: () => void
    onLogoutAll: () => void
}

// What Logout offers: end the login on this device, or on every device. It is a real modal dialog,
// so the keyboard stays inside it and Escape closes it.
function LogoutDialog({ isOpen, isWorking, error, onClose, onLogout, onLogoutAll }: LogoutDialogProps) {
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
                <h2 id="logout-dialog-title">Log out</h2>

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

                {error && <p role="alert" className="alert alert-error">{error}</p>}

                <button type="button" className="btn-text" disabled={isWorking} onClick={onClose}>Cancel</button>
            </div>
        </dialog>
    )
}

export default LogoutDialog
