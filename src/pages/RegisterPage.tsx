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
import { useRetryAfter } from "../lib/useRetryAfter"
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
    useDocumentTitle("Create your account")
    const passwordHintId = useId()
    const registerPrompt = readPendingCartItem() ? "Create an account to add this item to your cart." : ""
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [codeSentTo, setCodeSentTo] = useState<string | null>(null)// set once the confirmation code has been emailed
    const wait = useRetryAfter()
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
            wait.block(outcome.retryAfterSeconds)
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
        <AuthShell title="Create your StoreHatch account">
            <p className="auth-lead">Open your own shop, and shop from others, with one account. You can set up your shop now or later.</p>
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
                <button type="submit" className="btn-block btn-lg" disabled={isSubmitting || wait.remaining > 0}>
                    {wait.remaining > 0 ? `Try again in ${wait.remaining}s` : isSubmitting ? "Registering..." : "Create account"}
                </button>
                <GoogleSignInButton onCredential={google.handleCredential} disabled={google.isWorking || isSubmitting} />
                {google.error && <Notice kind="error">{google.error}</Notice>}
            </form>
            <p className="form-footer">Already have an account? <Link to={"/login"}>Log in</Link></p>
        </AuthShell>
    )
}

export default RegisterPage
