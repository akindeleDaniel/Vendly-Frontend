import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import type { AuthStatus, UserRole } from "../types/user"
import Logo from "./Logo"
import LogoutDialog from "./LogoutDialog"
import { HomeIcon } from "./Icons"
import { fetchAwaitingConfirmationCount } from "../lib/orderApi"
import { fetchComplaintsAwaitingSeller, fetchUnreadComplaintCount } from "../lib/disputeApi"
import { fetchPreOrdersAwaitingAnswer, listPreOrders } from "../lib/preOrderApi"
import { apiRequest } from "../lib/apiRequest"

// Login and registration pages show a centred logo above the form instead of the header.
const AUTH_PATHS = ["/login", "/register", "/consumer/register", "/seller/register", "/forgot-password"]

type NavbarProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
    isAdmin: boolean
    hasPassword: boolean
    onLogout: () => Promise<void>
    onLogoutAll: () => Promise<void>
}

function Navbar ({authStatus, userRole, isAdmin, hasPassword, onLogout, onLogoutAll}: NavbarProps){

    const {pathname} = useLocation()
    const navigate = useNavigate()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
    const [logoutError, setLogoutError] = useState("")
    const [awaitingCount, setAwaitingCount] = useState(0)
    const [complaintCount, setComplaintCount] = useState(0)
    const [unreadComplaints, setUnreadComplaints] = useState(0)
    const [preOrderCount, setPreOrderCount] = useState(0)
    const [showPreOrders, setShowPreOrders] = useState(false)// a seller who takes pre-orders, or a buyer who has asked for one
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

    // Pre-orders are only for food shops. A seller sees the link when the shop takes them (or still has
    // requests), with the count waiting for an answer; a buyer sees it once they have asked for one.
    useEffect(() => {
        if (!isSeller && !isConsumer) {
            return
        }

        const controller = new AbortController()

        async function check() {
            if (isConsumer) {
                const result = await listPreOrders("buyer", 1, "", controller.signal)
                if (!controller.signal.aborted) {
                    setShowPreOrders(result.kind === "ok" && result.data.total > 0)
                }
                return
            }

            const profile = await apiRequest<{ foodOrderType?: string }>("/seller/profile", { signal: controller.signal })
            const takesPreOrders = profile.kind === "ok" && (profile.data.foodOrderType === "PRE_ORDER" || profile.data.foodOrderType === "BOTH")
            const count = await fetchPreOrdersAwaitingAnswer(controller.signal)

            if (!controller.signal.aborted) {
                setPreOrderCount(count ?? 0)
                setShowPreOrders(takesPreOrders || (count ?? 0) > 0)
            }
        }

        check()
        return () => controller.abort()
    }, [isSeller, isConsumer, pathname])

    // Logs out of this device only, or of every device, then goes to the home page.
    // Complaints with something new in them for this person (a reply they have not opened).
    useEffect(() => {
        if (!isConsumer && !isSeller) {
            return
        }

        const controller = new AbortController()
        fetchUnreadComplaintCount(isSeller ? "seller" : "buyer", controller.signal).then((count) => {
            if (!controller.signal.aborted) {
                setUnreadComplaints(count ?? 0)
            }
        })
        return () => controller.abort()
    }, [isConsumer, isSeller, pathname])

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
                                {userRole === "CONSUMER" && showPreOrders && pathname !== "/pre-orders" && (
                                    <Link to="/pre-orders" className="header-link">Pre-orders</Link>
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
                                {userRole === "SELLER" && showPreOrders && pathname !== "/seller/pre-orders" && (
                                    <Link to="/seller/pre-orders" className="header-link">
                                        Pre-orders
                                        {preOrderCount > 0 && (
                                            <span className="count-badge" aria-label={`${preOrderCount} waiting for your answer`}>{preOrderCount}</span>
                                        )}
                                    </Link>
                                )}
                                {userRole === "SELLER" && pathname !== "/seller/disputes" && (
                                    <Link to="/seller/disputes" className="header-link">
                                        Complaints
                                        {complaintCount > 0 && (
                                            <span className="count-badge" aria-label={`${complaintCount} waiting for your response`}>{complaintCount}</span>
                                        )}
                                        {unreadComplaints > 0 && (
                                            <span className="count-badge count-badge-new" aria-label={`${unreadComplaints} with something new`}>{unreadComplaints} new</span>
                                        )}
                                    </Link>
                                )}
                                {userRole === "CONSUMER" && unreadComplaints > 0 && pathname !== "/disputes" && (
                                    <Link to="/disputes" className="header-link">
                                        Complaints
                                        <span className="count-badge count-badge-new" aria-label={`${unreadComplaints} with something new`}>{unreadComplaints} new</span>
                                    </Link>
                                )}
                                {isAdmin && !pathname.startsWith("/admin") && (
                                    <Link to="/admin" className="header-link">Admin</Link>
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
                hasPassword={hasPassword}
                onClose={() => setIsLogoutDialogOpen(false)}
                onLogout={() => handleLogout(false)}
                onLogoutAll={() => handleLogout(true)}
                onPassword={() => { setIsLogoutDialogOpen(false); navigate("/change-password") }}
            />
        </>
    )
}

export default Navbar
