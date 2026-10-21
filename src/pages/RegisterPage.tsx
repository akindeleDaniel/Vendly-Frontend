import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { readPendingCartItem } from "../lib/pendingCartItem"
import type { UserRole } from "../types/user"
import { checkPassword, registerAccount, resendCode, verifyCode } from "../lib/accountApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import AuthShell from "../components/AuthShell"
import CodeEntryForm from "../components/CodeEntryForm"
import GoogleSignInButton from "../components/GoogleSignInButton"
import GoogleSteps from "../components/GoogleSteps"
import { useGoogleSignIn } from "../lib/useGoogleSignIn"
import Notice from "../components/Notice"

type User = {
    name: string
    email: string
    password: string
}

type RegisterPageProps = {
    onLogin: (role: UserRole) => void
    role: UserRole
}

function RegisterPage ({onLogin, role}: RegisterPageProps){

    const [formData, setFormData] = useState<User>({
        name:"",
        email: "",
        password: ""
    })
    useDocumentTitle(role === "SELLER" ? "Create a seller account" : "Create an account")
    const passwordHintId = useId()
    const registerPrompt = role === "CONSUMER" && readPendingCartItem() ? "Create a shopper account to add this item to your cart." : ""
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [codeSentTo, setCodeSentTo] = useState<string | null>(null)// set once the confirmation code has been emailed
    const google = useGoogleSignIn(onLogin, role)// this page already knows whether the person is a buyer or a seller

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (isSubmitting) {
            return
        }

        if (formData.name.trim() === "" || formData.email.trim() === "" || formData.password === "") {
            setError("All areas must be filled")
            return
        }

        const passwordProblem = checkPassword(formData.password)
        if (passwordProblem) {
            setError(passwordProblem)
            return
        }

        setIsSubmitting(true)
        setError("")

        const outcome = await registerAccount({ ...formData, role })
        setIsSubmitting(false)

        if (outcome.kind === "error") {
            setError(outcome.message)
            return
        }

        // Registering does not log anyone in. A 6-digit code was emailed, and entering it confirms the
        // account and logs the person in.
        setCodeSentTo(outcome.email)
    }

    if (google.step !== null) {
        return <GoogleSteps google={google} />
    }

    if (codeSentTo !== null) {
        return (
            <AuthShell title="Check your email">
                <CodeEntryForm
                    email={codeSentTo}
                    verify={(code) => verifyCode("VERIFY_EMAIL", codeSentTo, code)}
                    resend={() => resendCode("VERIFY_EMAIL", codeSentTo)}
                    submitLabel="Confirm and continue"
                    backLabel="Use a different email"
                    onVerified={onLogin}
                    onBack={() => setCodeSentTo(null)}
                />
            </AuthShell>
        )
    }

    return(
        <AuthShell title={role === "SELLER" ? "Create a seller account" : "Create a shopper account"}>
            {registerPrompt && <Notice kind="info">{registerPrompt}</Notice>}
            <form onSubmit={handleSubmit} className="card form-card">
                <label>
                    Name
                    <input name="name"
                        autoComplete="name"
                        maxLength={80}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
                <label>
                    Email
                    <input name="email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
                <label>
                    Password
                    <input name="password"
                        type="password"
                        autoComplete="new-password"
                        aria-describedby={passwordHintId}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
                <p id={passwordHintId} className="field-help">At least 10 characters. Avoid common passwords.</p>
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn-block btn-lg" disabled={isSubmitting}>{isSubmitting ? "Registering..." : "Create account"}</button>
                <GoogleSignInButton onCredential={google.handleCredential} disabled={google.isWorking || isSubmitting} />
                {google.error && <Notice kind="error">{google.error}</Notice>}
            </form>
            <p className="form-footer">Already have an account? <Link to={"/login"}>Log in</Link></p>
        </AuthShell>
    )
}

export default RegisterPage
