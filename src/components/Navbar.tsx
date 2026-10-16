import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import type { AuthStatus, UserRole } from "../types/user"
import Logo from "./Logo"
import { HomeIcon } from "./Icons"

type NavbarProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
    onLogout: () => Promise<void>
}

function Navbar ({authStatus, userRole, onLogout}: NavbarProps){

    const {pathname} = useLocation()
    const navigate = useNavigate()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [logoutError, setLogoutError] = useState("")

    async function handleLogout() {
        setIsLoggingOut(true)
        setLogoutError("")

        try {
            await onLogout()
            navigate("/")
        } catch (error) {
            setLogoutError(
                error instanceof Error
                    ? error.message
                    : "Unable to log out. Please try again."
            )
        } finally {
            setIsLoggingOut(false)
        }
    }

    return(
        <>
            <header className="site-header">
                <Logo />
                {/* Account links are not shown until the session check has finished, so the wrong links never flash. */}
                {authStatus !== "loading" && (
                    <nav aria-label="Account" className="header-actions">
                        {authStatus === "authenticated" ? (
                            <>
                                {/* On the cart page the cart icon would point to itself, so a Home icon takes its place. */}
                                {userRole === "CONSUMER" && pathname === "/cart" && (
                                    <Link to="/" className="icon-link" aria-label="Home" title="Home">
                                        <HomeIcon size={24} />
                                    </Link>
                                )}
                                {userRole === "CONSUMER" && pathname !== "/cart" && (
                                    <Link to="/cart" className="icon-link" aria-label="Cart" title="Cart">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                                            <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6.2" />
                                            <circle cx="9.5" cy="19" r="1.3" />
                                            <circle cx="17" cy="19" r="1.3" />
                                        </svg>
                                    </Link>
                                )}
                                {userRole === "SELLER" && pathname !== "/seller/myListing" && (
                                    <Link to="/seller/myListing" className="header-link">My store</Link>
                                )}
                                <button type="button" className="btn-text" onClick={handleLogout} disabled={isLoggingOut}>
                                    {isLoggingOut ? "Logging out..." : "Logout"}
                                </button>
                            </>
                        ) : (
                            <>
                                {pathname !== "/login" && <Link to="/login" className="header-link">Login</Link>}
                                {pathname !== "/register" && <Link to="/register" className="btn btn-primary btn-sm">Register</Link>}
                            </>
                        )}
                    </nav>
                )}
            </header>
            {logoutError && <p role="alert" className="alert alert-error">{logoutError}</p>}
        </>
    )
}

export default Navbar
