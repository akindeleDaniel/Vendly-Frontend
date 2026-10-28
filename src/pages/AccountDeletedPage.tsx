import { Link } from "react-router-dom"
import { Check } from "lucide-react"
import { useDocumentTitle } from "../lib/useDocumentTitle"

// Shown once, right after someone deletes their account. It needs no login, since there is none any more.
function AccountDeletedPage() {
    useDocumentTitle("Account deleted")

    return (
        <section className="account-deleted" aria-labelledby="account-deleted-title">
            <span className="account-icon is-large" aria-hidden="true"><Check size={30} strokeWidth={2.4} /></span>
            <h1 id="account-deleted-title">Your account is deleted</h1>
            <p>
                We've logged you out on every phone and computer. Your name, email and delivery details are gone. Orders and
                payments stay on StoreHatch without your name, and your reviews now show as “A former buyer”.
            </p>
            <p>You can sign up again with the same email any time, as a new account.</p>
            <Link to="/" className="btn btn-primary">Go to the home page</Link>
        </section>
    )
}

export default AccountDeletedPage
