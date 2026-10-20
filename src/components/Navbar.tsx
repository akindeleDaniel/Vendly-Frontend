import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import type { AuthStatus, UserRole } from "../types/user"
import Logo from "./Logo"
import LogoutDialog from "./LogoutDialog"
import { HomeIcon } from "./Icons"
import { fetchAwaitingConfirmationCount } from "../lib/orderApi"
import { fetchComplaintsAwaitingSeller } from "../lib/disputeApi"

// Login and registration pages show a centred logo above the form instead of the header.
const AUTH_PATHS = ["/login", "/register", "/consumer/register", "/seller/register", "/forgot-password"]

type NavbarProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
    isAdmin: boolean
    onLogout: () => Promise<void>
    onLogoutAll: () => Promise<void>
}

function Navbar ({authStatus, userRole, isAdmin, onLogout, onLogoutAll}: NavbarProps){

    const {pathname} = useLocation()
    const navigate = useNavigate()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
    const [logoutError, setLogoutError] = useState("")
    const [awaitingCount, setAwaitingCount] = useState(0)
    const [complaintCount, setComplaintCount] = useState(0)
    const isConsumer = authStatus === "authenticated" && userRole === "CONSUMER"
    const isSeller = authStatus === "authenticated" && userRole === "SELLER"

    // Orders the seller has reported delivered that the shopper has not confirmed yet. Checked when
    // the shopper moves between pages, so the count follows what they confirm.
    useEffect(() => {
        if (!isConsumer) {
            return
        }

        const controller = new AbortController()
        fetchAwaitingConfirmationCount(controller.signal).then((count) => {
            if (!controller.signal.aborted) {
                setAwaitingCount(count ?? 0)
            }
        })
        return () => controller.abort()
    }, [isConsumer, pathname])

    // Complaints waiting for the seller's answer, checked the same way.
    useEffect(() => {
        if (!isSeller) {
            return
        }

        const controller = new AbortController()
        fetchComplaintsAwaitingSeller(controller.signal).then((count) => {
            if (!controller.signal.aborted) {
                setComplaintCount(count ?? 0)
            }
        })
        return () => controller.abort()
    }, [isSeller, pathname])

    // Logs out of this device only, or of every device, then goes to the home page.
    async function handleLogout(everywhere: boolean) {
        setIsLoggingOut(true)
        setLogoutError("")

        try {
            await (everywhere ? onLogoutAll() : onLogout())
            setIsLogoutDialogOpen(false)
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

    if (AUTH_PATHS.includes(pathname)) {
        return null
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
                                {userRole === "CONSUMER" && pathname !== "/orders" && (
                                    <Link to="/orders" className="header-link">
                                        My orders
                                        {awaitingCount > 0 && (
                                            <span className="count-badge" aria-label={`${awaitingCount} awaiting your confirmation`}>{awaitingCount}</span>
                                        )}
                                    </Link>
                                )}
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
                                {userRole === "SELLER" && pathname !== "/seller/orders" && (
                                    <Link to="/seller/orders" className="header-link">Orders</Link>
                                )}
                                {userRole === "SELLER" && pathname !== "/seller/disputes" && (
                                    <Link to="/seller/disputes" className="header-link">
                                        Complaints
                                        {complaintCount > 0 && (
                                            <span className="count-badge" aria-label={`${complaintCount} waiting for your response`}>{complaintCount}</span>
                                        )}
                                    </Link>
                                )}
                                {isAdmin && !pathname.startsWith("/admin") && (
                                    <Link to="/admin/complaints" className="header-link">Admin</Link>
                                )}
                                {userRole === "SELLER" && pathname !== "/seller/myListing" && (
                                    <Link to="/seller/myListing" className="header-link">My store</Link>
                                )}
                                <button type="button" className="btn-text" onClick={() => { setLogoutError(""); setIsLogoutDialogOpen(true) }}>
                                    Logout
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
            <LogoutDialog
                isOpen={isLogoutDialogOpen}
                isWorking={isLoggingOut}
                error={logoutError}
                onClose={() => setIsLogoutDialogOpen(false)}
                onLogout={() => handleLogout(false)}
                onLogoutAll={() => handleLogout(true)}
            />
        </>
    )
}

export default Navbar
