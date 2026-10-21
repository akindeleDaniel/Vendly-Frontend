import { useState } from "react"
import ChangePasswordPage from "./ChangePasswordPage"
import SetPasswordPage from "./SetPasswordPage"

type PasswordPageProps = {
    hasPassword: boolean
    backTo: string
    onPasswordSet: () => void
}

// The page behind "Change password": an account with a password changes it; an account made with
// Google, which has none, sets one. Which it is stays fixed while the page is open, so the "password
// set" message is not replaced by the change form the moment the account gains a password.
function PasswordPage({ hasPassword, backTo, onPasswordSet }: PasswordPageProps) {
    const [startedWithoutPassword] = useState(!hasPassword)

    return startedWithoutPassword
        ? <SetPasswordPage backTo={backTo} onPasswordSet={onPasswordSet} />
        : <ChangePasswordPage backTo={backTo} />
}

export default PasswordPage
