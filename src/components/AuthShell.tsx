import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Check } from "lucide-react"
import Logo, { LogoBadge } from "./Logo"
import { BRAND_NAME, BRAND_WORDMARK } from "../lib/brand"

type AuthShellProps = {
    title: string
    lead?: ReactNode// a line under the heading
    icon?: ReactNode// a round icon above the heading, on the code and password screens
    children: ReactNode
}

const PROMISES = [
    "Your own shop page and link to share",
    "Customers pay with Paystack or Flutterwave",
    "Help from StoreHatch if an order goes wrong"
]

// The frame of the sign-in screens: on wide screens a green panel about StoreHatch beside the form,
// on phones the logo above it. The site header is hidden on these paths (see AUTH_PATHS in Navbar.tsx).
function AuthShell({ title, lead, icon, children }: AuthShellProps) {
    return (
        <div className="auth-page">
            <aside className="auth-panel" aria-label={`About ${BRAND_NAME}`}>
                <Link to="/" className="auth-panel-brand" aria-label={`${BRAND_NAME} home`}>
                    <LogoBadge size={48} />
                    <span aria-hidden="true">{BRAND_WORDMARK}</span>
                </Link>
                {/* Photos move a little on their own; they stay still for people who ask for less motion. */}
                <div className="auth-mosaic" aria-hidden="true">
                    <span className="auth-mosaic-main"><img src="/images/auth/shopper-phone.jpg" alt="" /></span>
                    <span className="auth-mosaic-top"><img src="/images/auth/shopper-bags.jpg" alt="" /></span>
                    <span className="auth-mosaic-bottom"><img src="/images/auth/tailor.jpg" alt="" /></span>
                </div>
                <div>
                    <h2>Your shop, open in minutes.</h2>
                    <p>Sell what you make, and shop from other StoreHatch shops, with one account.</p>
                    <ul className="auth-promises">
                        {PROMISES.map((promise) => (
                            <li key={promise}><span aria-hidden="true"><Check size={12} strokeWidth={3.4} /></span>{promise}</li>
                        ))}
                    </ul>
                </div>
            </aside>

            <main className="auth-main">
                <div className="auth-topbar">
                    <span className="auth-phone-logo"><Logo /></span>
                    <Link to="/" className="auth-home"><ArrowLeft size={18} aria-hidden="true" />Back to home</Link>
                </div>
                <div className="auth-center">
                    <div className="auth-box">
                        {icon && <span className="auth-icon" aria-hidden="true">{icon}</span>}
                        <h1>{title}</h1>
                        {lead && <p className="auth-lead">{lead}</p>}
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}

export default AuthShell
