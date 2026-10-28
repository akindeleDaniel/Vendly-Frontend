import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import type { AuthStatus, UserRole } from "../types/user"
import Logo from "./Logo"
import LogoutDialog from "./LogoutDialog"
import SellerStoreLink from "./SellerStoreLink"
import { ChevronLeftIcon, HomeIcon } from "./Icons"
import { BRAND_WORDMARK } from "../lib/brand"
import { Lock, UserRound } from "lucide-react"
import { fetchAwaitingConfirmationCount } from "../lib/orderApi"
import { fetchUnreadComplaintCount } from "../lib/disputeApi"
import { listPreOrders } from "../lib/preOrderApi"

// Login and registration pages show a centred logo above the form instead of the header.
const AUTH_PATHS = ["/login", "/register", "/consumer/register", "/seller/register", "/forgot-password"]

type NavbarProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
    isAdmin: boolean
    hasPassword: boolean
    userName: string // for "Hi Balake" in the strip above a shop
    onLogout: () => Promise<void>
    onLogoutAll: () => Promise<void>
}

function Navbar ({authStatus, userRole, isAdmin, hasPassword, userName, onLogout, onLogoutAll}: NavbarProps){

    const {pathname, search} = useLocation()
    const navigate = useNavigate()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
    const [logoutError, setLogoutError] = useState("")
    const [awaitingCount, setAwaitingCount] = useState(0)
    const [unreadComplaints, setUnreadComplaints] = useState(0)
    const [showPreOrders, setShowPreOrders] = useState(false)// a buyer who has asked for a pre-order
    // Every account can buy, sellers included, so the buyer links show for both. An administrator doesn't shop or sell.
    const isConsumer = authStatus === "authenticated" && !isAdmin && (userRole === "CONSUMER" || userRole === "SELLER")

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

    // Pre-orders are only for food shops: a buyer sees the link once they have asked for one.
    useEffect(() => {
        if (!isConsumer) {
            return
        }

        const controller = new AbortController()
        listPreOrders("buyer", 1, "all", controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setShowPreOrders(result.kind === "ok" && result.data.total > 0)
            }
        })
        return () => controller.abort()
    }, [isConsumer, pathname])

    // Complaints with something new in them for a buyer (a reply they have not opened). A seller's
    // counts are in the seller menu.
    useEffect(() => {
        if (!isConsumer) {
            return
        }

        const controller = new AbortController()
        fetchUnreadComplaintCount("buyer", controller.signal).then((count) => {
            if (!controller.signal.aborted) {
                setUnreadComplaints(count ?? 0)
            }
        })
        return () => controller.abort()
    }, [isConsumer, pathname])

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

    // Checkout keeps only the logo and a reassurance, so nothing pulls the shopper away mid-payment.
    if (pathname === "/checkout" || pathname === "/checkout/payment-return") {
        return (
            <header className="site-header is-checkout">
                <Logo />
                <span className="checkout-secure"><Lock aria-hidden="true" size={18} />Secure checkout</span>
            </header>
        )
    }

    // A shop page (and a product inside it) is the shop's own site: StoreHatch shrinks to a thin strip
    // above it, with a way back to the search the shopper came from. The shop's header has the cart.
    const isShopPage = pathname.startsWith("/shop/") || pathname.startsWith("/product/")
    const firstName = userName.trim().split(/\s+/)[0]
    const backToSearch = (() => {
        const from = new URLSearchParams(search)
        const back = new URLSearchParams()
        for (const key of ["category", "search"]) {
            const value = from.get(key)
            if (value) {
                back.set(key, value)
            }
        }
        const query = back.toString()
        return query ? `/?${query}` : "/"
    })()

    return(
        <>
            <header className={isShopPage ? "site-header is-shop-strip" : "site-header"}>
                <div className="header-brand">
                    {isShopPage ? (
                        <Link to={backToSearch} className="back-link strip-back">
                            <ChevronLeftIcon />
                            Back to <span className="strip-wordmark">{BRAND_WORDMARK}</span>
                        </Link>
                    ) : <Logo />}
                </div>
                {/* Account links are not shown until the session check has finished, so the wrong links never flash. */}
                {authStatus !== "loading" && (
                    <nav aria-label="Account" className="header-actions">
                        {authStatus === "authenticated" ? (
                            <>
                                {isShopPage && firstName && (
                                    <span className="strip-hi"><UserRound aria-hidden="true" size={16} />Hi {firstName}</span>
                                )}
                                {userRole === "SELLER" && !isAdmin && <SellerStoreLink />}
                                {/* On the cart page the cart icon would point to itself, so a Home icon takes its place. */}
                                {isConsumer && pathname !== "/orders" && (
                                    <Link to="/orders" className="header-link">
                                        My orders
                                        {awaitingCount > 0 && (
                                            <span className="count-badge" aria-label={`${awaitingCount} awaiting your confirmation`}>{awaitingCount}</span>
                                        )}
                                    </Link>
                                )}
                                {isConsumer && showPreOrders && pathname !== "/pre-orders" && (
                                    <Link to="/pre-orders" className="header-link">Pre-orders</Link>
                                )}
                                {isConsumer && pathname === "/cart" && (
                                    <Link to="/" className="icon-link" aria-label="Home" title="Home">
                                        <HomeIcon size={24} />
                                    </Link>
                                )}
                                {isConsumer && pathname !== "/cart" && !isShopPage && (
                                    <Link to="/cart" className="icon-link" aria-label="Cart" title="Cart">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                                            <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6.2" />
                                            <circle cx="9.5" cy="19" r="1.3" />
                                            <circle cx="17" cy="19" r="1.3" />
                                        </svg>
                                    </Link>
                                )}
                                {isConsumer && unreadComplaints > 0 && pathname !== "/disputes" && (
                                    <Link to="/disputes" className="header-link">
                                        Complaints
                                        <span className="count-badge count-badge-new" aria-label={`${unreadComplaints} with something new`}>{unreadComplaints} new</span>
                                    </Link>
                                )}
                                {isAdmin && !pathname.startsWith("/admin") && (
                                    <Link to="/admin" className="header-link">Admin</Link>
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
                onAccount={() => { setIsLogoutDialogOpen(false); navigate("/account") }}
            />
        </>
    )
}

export default Navbar
