import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronLeftIcon } from "./Icons"
import Logo from "./Logo"

// The frame of the sign-in screens: the large centred logo, the heading, and a way back home. The
// site header is hidden on these paths (see AUTH_PATHS in Navbar.tsx).
function AuthShell({ title, children }: { title: string, children: ReactNode }) {
    return (
        <div className="form-page">
            <div className="auth-brand"><Logo size="large" /></div>
            <h1>{title}</h1>
            {children}
            <p className="form-footer">
                <Link to="/" className="back-link"><ChevronLeftIcon /> Back to home</Link>
            </p>
        </div>
    )
}

export default AuthShell
