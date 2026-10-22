import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { readPendingCartItem } from "../lib/pendingCartItem"
import type { UserRole } from "../types/user"
import { logIn, resendCode, verifyCode } from "../lib/accountApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import AuthShell from "../components/AuthShell"
import CodeEntryForm from "../components/CodeEntryForm"
import GoogleSignInButton from "../components/GoogleSignInButton"
import GoogleSteps from "../components/GoogleSteps"
import { useGoogleSignIn } from "../lib/useGoogleSignIn"
import { useRetryAfter } from "../lib/useRetryAfter"
import Notice from "../components/Notice"
import type { CodePurpose } from "../lib/accountApi"

type ExistingUser = {
    email: string
    password: string
}

type LoginPageProps = {
    onLogin: (role: UserRole) => void
    sessionExpired: boolean
}

// After the password is right, the backend may still ask for a code: on a browser it does not know,
// or for an account whose email was never confirmed.
type CodeStep = {
    email: string
    purpose: CodePurpose
    notice?: string
}

function LoginPage ({onLogin, sessionExpired}: LoginPageProps){

    const [formData, setFormData] = useState<ExistingUser>({
        email: "",
        password: ""
    })
    useDocumentTitle("Log in")
    const location = useLocation()
    const passwordWasReset = typeof location.state === "object" && location.state !== null && "passwordReset" in location.state
    const loginPrompt = readPendingCartItem() ? "Log in or register to add this item to your cart." : ""
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [codeStep, setCodeStep] = useState<CodeStep | null>(null)
    const google = useGoogleSignIn(onLogin)
    const wait = useRetryAfter()

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (isSubmitting) {
            return
        }

        if (formData.email === "" || formData.password === "") {
            setError("All areas must be filled")
            return
        }

        setIsSubmitting(true)
        setError("")

        const outcome = await logIn(formData.email, formData.password)
        setIsSubmitting(false)

        switch (outcome.kind) {
            case "logged-in":
                // Updating the session state is enough: the route guard sends the user to their home page,
                // and sellers without a store profile are sent on to onboarding from there.
                onLogin(outcome.role)
                break
            case "code-required":
                setCodeStep({ email: outcome.email, purpose: "LOGIN", notice: "We do not recognise this browser yet, so we need to check it is you." })
                break
            case "unverified":
                setCodeStep({ email: outcome.email, purpose: "VERIFY_EMAIL", notice: "Your email has not been confirmed yet. Enter the code we just sent to finish creating your account." })
                break
            case "error":
                setError(outcome.message)
                wait.block(outcome.retryAfterSeconds)
                break
        }
    }

    if (google.step !== null) {
        return <GoogleSteps google={google} />
    }

    if (codeStep !== null) {
        return (
            <AuthShell title={codeStep.purpose === "LOGIN" ? "Enter the code we emailed you" : "Confirm your email"}>
                <CodeEntryForm
                    email={codeStep.email}
                    verify={(code) => verifyCode(codeStep.purpose, codeStep.email, code)}
                    resend={() => resendCode(codeStep.purpose, codeStep.email)}
                    notice={codeStep.notice}
                    submitLabel={codeStep.purpose === "LOGIN" ? "Log in" : "Confirm and continue"}
                    backLabel={codeStep.purpose === "LOGIN" ? "Log in with a different account" : "Use a different email"}
                    onVerified={onLogin}
                    onBack={() => { setCodeStep(null); setFormData({ email: "", password: "" }) }}
                />
            </AuthShell>
        )
    }

    return(
        <AuthShell title="Log in">
            {passwordWasReset && <Notice kind="success">Your password has been changed. Log in with your new password.</Notice>}
            {sessionExpired && <Notice kind="info">Your session has expired. Please log in again.</Notice>}
            {loginPrompt && !sessionExpired && <Notice kind="info">{loginPrompt}</Notice>}
            <form onSubmit={handleSubmit} className="card form-card">
                <label>
                    Email
                    <input name="email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
                <label>
                    Password
                    <input name="password"
                        type="password"
                        autoComplete="current-password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn-block btn-lg" disabled={isSubmitting || wait.remaining > 0}>
                    {wait.remaining > 0 ? `Try again in ${wait.remaining}s` : isSubmitting ? "Logging in..." : "Log in"}
                </button>
                <GoogleSignInButton onCredential={google.handleCredential} disabled={google.isWorking || isSubmitting} />
                {google.error && <Notice kind="error">{google.error}</Notice>}
                <p className="form-footer"><Link to="/forgot-password">Forgot your password?</Link></p>
            </form>
            <p className="form-footer">Don't have an account? <Link to={"/register"}>Register</Link></p>
        </AuthShell>
    )
}

export default LoginPage
