import { Mail } from "lucide-react"
import AuthShell from "./AuthShell"
import CodeEntryForm from "./CodeEntryForm"
import Notice from "./Notice"
import { googleLink, googleSignIn, resendCode, verifyCode } from "../lib/accountApi"
import type { GoogleSignIn } from "../lib/useGoogleSignIn"

// The screens Google sign-in can lead to: choose buyer or seller (a new person), or enter the code
// that was emailed (linking Google to an existing account, or an administrator's login code).
function GoogleSteps({ google }: { google: GoogleSignIn }) {
    const { step } = google

    if (step === null) {
        return null
    }

    if (step.kind === "role") {
        return (
            <AuthShell title="Are you a buyer or a seller?">
                <p>{step.name ? `Welcome, ${step.name}. ` : ""}Choose how you will use StoreHatch with {step.email}.</p>
                <div className="role-options">
                    <button type="button" className="role-card" disabled={google.isWorking} onClick={() => google.chooseRole("CONSUMER")}>
                        <span className="role-card-title">I want to shop</span>
                        <span className="role-card-text">Browse products, add them to your cart and check out.</span>
                    </button>
                    <button type="button" className="role-card" disabled={google.isWorking} onClick={() => google.chooseRole("SELLER")}>
                        <span className="role-card-title">I want to sell</span>
                        <span className="role-card-text">Open a store, add your listings and reach shoppers.</span>
                    </button>
                </div>
                {google.error && <Notice kind="error">{google.error}</Notice>}
                <p className="form-footer">
                    <button type="button" className="btn-text" disabled={google.isWorking} onClick={google.reset}>Use a different Google account</button>
                </p>
            </AuthShell>
        )
    }

    if (step.kind === "link") {
        return (
            <AuthShell title="Confirm it is you" icon={<Mail size={30} />}>
                <CodeEntryForm
                    email={step.email}
                    notice="An account with this email already exists. We emailed you a code so that only the owner can link Google to it."
                    verify={(code) => googleLink(step.credential, code)}
                    // Asking Google sign-in again is how a new code is sent; the answer is the same "link required".
                    resend={async () => {
                        const outcome = await googleSignIn(step.credential)
                        return outcome.kind === "link-required"
                            ? { kind: "ok", message: "If a code is due, we have emailed it." }
                            : { kind: "error", message: outcome.kind === "error" ? outcome.message : "Please try signing in with Google again." }
                    }}
                    submitLabel="Confirm and log in"
                    backLabel="Use a different Google account"
                    onVerified={google.onLogin}
                    onBack={google.reset}
                />
            </AuthShell>
        )
    }

    return (
        <AuthShell title="Enter the code we emailed you" icon={<Mail size={30} />}>
            <CodeEntryForm
                email={step.email}
                notice="Administrator accounts always need a code, even with Google."
                verify={(code) => verifyCode("LOGIN", step.email, code)}
                resend={() => resendCode("LOGIN", step.email)}
                submitLabel="Log in"
                backLabel="Use a different account"
                onVerified={google.onLogin}
                onBack={google.reset}
            />
        </AuthShell>
    )
}

export default GoogleSteps
