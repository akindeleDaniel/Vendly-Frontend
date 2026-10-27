import { BrowserRouter, Routes, Route } from "react-router-dom"
import RegisterPage from "./pages/RegisterPage"
import LoginPage from "./pages/LoginPage"
import RolePage from "./pages/RolePage"
import DiscoveryPage from "./pages/DiscoveryPage"
import MyListingPage from "./pages/MyListingPage"
import SellerOnboardingPage from "./pages/SellerOnboardingPage"
import EditSellerProfilePage from "./pages/EditSellerProfilePage"
import PayoutSettingsPage from "./pages/PayoutSettingsPage"
import Navbar from "./components/Navbar"
import ShopPage from "./pages/ShopPage"
import CartPage from "./pages/CartPage"
import CheckoutPage from "./pages/CheckoutPage"
import PaymentReturnPage from "./pages/PaymentReturnPage"
import MyOrdersPage from "./pages/MyOrdersPage"
import OrderDetailPage from "./pages/OrderDetailPage"
import SellerOrdersPage from "./pages/SellerOrdersPage"
import SellerOrderDetailPage from "./pages/SellerOrderDetailPage"
import AdminShell from "./components/AdminShell"
import AdminDashboardPage from "./pages/AdminDashboardPage"
import AdminOrderDetailPage from "./pages/AdminOrderDetailPage"
import AdminOrdersPage from "./pages/AdminOrdersPage"
import AdminUserDetailPage from "./pages/AdminUserDetailPage"
import AdminUsersPage from "./pages/AdminUsersPage"
import SellerEarningsPage from "./pages/SellerEarningsPage"
import SellerReviewsPage from "./pages/SellerReviewsPage"
import DeliveryFeesPage from "./pages/DeliveryFeesPage"
import PreOrderListPage from "./pages/PreOrderListPage"
import PreOrderDetailPage from "./pages/PreOrderDetailPage"
import AdminReviewsPage from "./pages/AdminReviewsPage"
import NotFoundPage from "./pages/NotFoundPage"
import ProductPage from "./pages/ProductPage"
import PasswordPage from "./pages/PasswordPage"
import SetPasswordPrompt from "./components/SetPasswordPrompt"
import { clearPasswordPromptDismissed } from "./lib/passwordPrompt"
import ForgotPasswordPage from "./pages/ForgotPasswordPage"
import AdminLiabilitiesPage from "./pages/AdminLiabilitiesPage"
import AdminRecoveryCasesPage from "./pages/AdminRecoveryCasesPage"
import AdminRefundsPage from "./pages/AdminRefundsPage"
import DisputeDetailPage from "./pages/DisputeDetailPage"
import DisputeListPage from "./pages/DisputeListPage"
import NewDisputePage from "./pages/NewDisputePage"
import OfferRefundPage from "./pages/OfferRefundPage"
import SellerLiabilitiesPage from "./pages/SellerLiabilitiesPage"
import { RedirectIfAuthenticated, RequireAdmin, RequireRole, RequireSession, RequireSuperAdmin } from "./components/RouteGuards"
import AdminPlatformPage from "./pages/AdminPlatformPage"
import AdminTeamPage from "./pages/AdminTeamPage"
import AdminAuditLogPage from "./pages/AdminAuditLogPage"
import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetch, getErrorMessage, setUnauthorizedHandler } from "./lib/api"
import { clearPendingCartItem } from "./lib/pendingCartItem"
import type { AuthStatus, UserRole } from "./types/user"
import { ScrollToTop, SkipLink } from "./components/PageShell"

function isUserRole(value: unknown): value is UserRole {
  return value === "CONSUMER" || value === "SELLER"
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading")// starts as loading since the session is still being checked
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loginCount, setLoginCount] = useState(0)// a new login starts the "set a password" pop-up afresh
  const [hasPassword, setHasPassword] = useState(true)// false for an account made with Google that has not set one
  const [userName, setUserName] = useState("")// for the "Hi Balake" greeting
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)// shows the platform, team and audit log screens; the backend checks it too
  const [isAdmin, setIsAdmin] = useState(false)// only decides what to show; the backend checks it on every admin request
  const [sessionExpired, setSessionExpired] = useState(false)
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0)
  const authStatusRef = useRef<AuthStatus>("loading")

  useEffect(() => {
    authStatusRef.current = authStatus
  }, [authStatus])

  // The login response does not say whether the person is an administrator or has a password, so
  // ask the session check.
  async function refreshAccountFlags() {
    try {
      const response = await apiFetch("/users/check", { credentials: "include" })
      if (response.ok) {
        const data: unknown = await response.json()
        setIsAdmin(typeof data === "object" && data !== null && "isAdmin" in data && data.isAdmin === true)
        setIsSuperAdmin(typeof data === "object" && data !== null && "isSuperAdmin" in data && data.isSuperAdmin === true)
        setUserName(typeof data === "object" && data !== null && "name" in data && typeof data.name === "string" ? data.name : "")
        setHasPassword(!(typeof data === "object" && data !== null && "hasPassword" in data && data.hasPassword === false))
      }
    } catch {
      // The admin link simply stays hidden.
    }
  }

  function handleLogin(role: UserRole) {
    if (role !== "CONSUMER") {
      clearPendingCartItem()// only a shopper can complete a remembered add-to-cart
    }
    setUserRole(role)
    setAuthStatus("authenticated")
    setSessionExpired(false)
    clearPasswordPromptDismissed()
    setLoginCount((count) => count + 1)
    void refreshAccountFlags()
  }

  async function handleLogout() {
    const response = await apiFetch("/users/logout", {
      method: "POST",
      credentials: "include"
    })

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, `Unable to log out (status ${response.status}).`))
    }

    clearPendingCartItem()// a remembered add-to-cart must not carry over to whoever logs in next
    setAuthStatus("unauthenticated")
    setUserRole(null)
    setIsAdmin(false)
  }

  // Ends every login of this account on every device, this one included.
  async function handleLogoutAll() {
    const response = await apiFetch("/users/logout-all", {
      method: "POST",
      credentials: "include"
    })

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, `Unable to log out on all devices (status ${response.status}).`))
    }

    clearPendingCartItem()
    setAuthStatus("unauthenticated")
    setUserRole(null)
    setIsAdmin(false)
  }

  const retryAuthCheck = useCallback(() => {
    setAuthStatus("loading")
    setAuthCheckAttempt((attempt) => attempt + 1)
  }, [])

  // An authenticated request rejected with 401 means the session is gone (for example it expired).
  useEffect(() => {
    return setUnauthorizedHandler(() => {
      if (authStatusRef.current !== "authenticated") {
        return
      }
      setSessionExpired(true)
      setAuthStatus("unauthenticated")
      setUserRole(null)
      setIsAdmin(false)
    })
  }, [])

  useEffect(() => { // the reason we have a function in the use effect is because useEffect doesn't allow the use of async in it so we havve to create a function that accepts it
    const controller = new AbortController()

    async function checkAuth() {
      try {
        const response = await apiFetch("/users/check", {
          credentials: "include",
          signal: controller.signal
        })

        if (controller.signal.aborted) {
          return
        }

        if (response.status === 401) {
          setAuthStatus("unauthenticated")
          setUserRole(null)
          return
        }

        if (!response.ok) {
          // A server error says nothing about whether the user is logged in.
          setAuthStatus("error")
          return
        }

        const data: unknown = await response.json()
        if (typeof data === "object" && data !== null && "role" in data && isUserRole(data.role)) {
          setUserRole(data.role)
          setIsAdmin("isAdmin" in data && data.isAdmin === true)
          setIsSuperAdmin("isSuperAdmin" in data && data.isSuperAdmin === true)
          setUserName("name" in data && typeof data.name === "string" ? data.name : "")
          setHasPassword(!("hasPassword" in data && data.hasPassword === false))
          setAuthStatus("authenticated")
        } else {
          setAuthStatus("error")
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Unable to check authentication:", error)
          setAuthStatus("error")
        }
      }
    }
    checkAuth()

    return () => controller.abort()
  }, [authCheckAttempt] // runs once when the app starts, and again when the user retries a failed check
  )

  const guardProps = { authStatus, userRole, isAdmin, isSuperAdmin, onRetry: retryAuthCheck }

  return (
    <BrowserRouter>
      <SkipLink />
      <ScrollToTop />
      <Navbar authStatus={authStatus} userRole={userRole} isAdmin={isAdmin} hasPassword={hasPassword} userName={authStatus === "authenticated" ? userName : ""} onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
      <SetPasswordPrompt key={loginCount} authStatus={authStatus} hasPassword={hasPassword} />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<DiscoveryPage userName={authStatus === "authenticated" ? userName : ""} />} />

          <Route path="/register" element={<RedirectIfAuthenticated {...guardProps}><RolePage /></RedirectIfAuthenticated>} />

          <Route path="/consumer/register" element={<RedirectIfAuthenticated {...guardProps}><RegisterPage onLogin={handleLogin} role="CONSUMER"/></RedirectIfAuthenticated>} />

          <Route path="/seller/register" element={<RedirectIfAuthenticated {...guardProps}><RegisterPage onLogin={handleLogin} role="SELLER"/></RedirectIfAuthenticated>} />

          <Route path="/login" element={<RedirectIfAuthenticated {...guardProps}><LoginPage onLogin={handleLogin} sessionExpired={sessionExpired}/></RedirectIfAuthenticated>} />

          <Route path="/forgot-password" element={<RedirectIfAuthenticated {...guardProps}><ForgotPasswordPage /></RedirectIfAuthenticated>} />

          <Route path="/change-password" element={<RequireSession {...guardProps}><PasswordPage hasPassword={hasPassword} backTo={userRole === "SELLER" ? "/seller/myListing" : "/orders"} onPasswordSet={() => void refreshAccountFlags()} /></RequireSession>} />

          <Route path="/seller/onboarding" element={<RequireRole role="SELLER" {...guardProps}><SellerOnboardingPage /></RequireRole>} />

          <Route path="/seller/profile/edit" element={<RequireRole role="SELLER" {...guardProps}><EditSellerProfilePage /></RequireRole>} />

          <Route path="/seller/delivery" element={<RequireRole role="SELLER" {...guardProps}><DeliveryFeesPage /></RequireRole>} />

          <Route path="/seller/payouts" element={<RequireRole role="SELLER" {...guardProps}><PayoutSettingsPage hasPassword={hasPassword} /></RequireRole>} />

          <Route path="/seller/orders" element={<RequireRole role="SELLER" {...guardProps}><SellerOrdersPage /></RequireRole>} />

          <Route path="/seller/orders/:id" element={<RequireRole role="SELLER" {...guardProps}><SellerOrderDetailPage /></RequireRole>} />

          <Route path="/seller/orders/:id/refund-offer" element={<RequireRole role="SELLER" {...guardProps}><OfferRefundPage /></RequireRole>} />

          <Route path="/seller/disputes" element={<RequireRole role="SELLER" {...guardProps}><DisputeListPage viewer="seller" /></RequireRole>} />

          <Route path="/seller/disputes/:id" element={<RequireRole role="SELLER" {...guardProps}><DisputeDetailPage viewer="seller" /></RequireRole>} />

          <Route path="/seller/pre-orders" element={<RequireRole role="SELLER" {...guardProps}><PreOrderListPage viewer="seller" /></RequireRole>} />

          <Route path="/seller/pre-orders/:id" element={<RequireRole role="SELLER" {...guardProps}><PreOrderDetailPage viewer="seller" /></RequireRole>} />

          <Route path="/pre-orders" element={<RequireRole role="CONSUMER" {...guardProps}><PreOrderListPage viewer="buyer" /></RequireRole>} />

          <Route path="/pre-orders/:id" element={<RequireRole role="CONSUMER" {...guardProps}><PreOrderDetailPage viewer="buyer" /></RequireRole>} />

          <Route path="/seller/reviews" element={<RequireRole role="SELLER" {...guardProps}><SellerReviewsPage /></RequireRole>} />

          <Route path="/seller/earnings" element={<RequireRole role="SELLER" {...guardProps}><SellerEarningsPage /></RequireRole>} />

          <Route path="/seller/liabilities" element={<RequireRole role="SELLER" {...guardProps}><SellerLiabilitiesPage /></RequireRole>} />

          <Route path="/seller/myListing" element={<RequireRole role="SELLER" {...guardProps}><MyListingPage userName={userName} /></RequireRole>} />

          <Route path="/product/:id" element={<ProductPage userRole={userRole} authStatus={authStatus} />} />

          <Route path="/shop/:slug" element={<ShopPage userRole={userRole} />} />

          <Route path="/cart" element={<RequireRole role="CONSUMER" {...guardProps}><CartPage /></RequireRole>} />

          <Route path="/checkout" element={<RequireRole role="CONSUMER" {...guardProps}><CheckoutPage /></RequireRole>} />

          <Route path="/orders" element={<RequireRole role="CONSUMER" {...guardProps}><MyOrdersPage /></RequireRole>} />

          <Route path="/orders/:id" element={<RequireRole role="CONSUMER" {...guardProps}><OrderDetailPage /></RequireRole>} />

          <Route path="/orders/:checkoutId/seller-orders/:orderId/complaint" element={<RequireRole role="CONSUMER" {...guardProps}><NewDisputePage /></RequireRole>} />

          <Route path="/disputes" element={<RequireRole role="CONSUMER" {...guardProps}><DisputeListPage viewer="buyer" /></RequireRole>} />

          <Route path="/disputes/:id" element={<RequireRole role="CONSUMER" {...guardProps}><DisputeDetailPage viewer="buyer" /></RequireRole>} />

          <Route path="/admin" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminDashboardPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/orders" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminOrdersPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/orders/:id" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminOrderDetailPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/users" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminUsersPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/users/:id" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminUserDetailPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/complaints" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><DisputeListPage viewer="admin" /></AdminShell></RequireAdmin>} />

          <Route path="/admin/complaints/:id" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><DisputeDetailPage viewer="admin" /></AdminShell></RequireAdmin>} />

          <Route path="/admin/refunds" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminRefundsPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/reviews" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminReviewsPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/platform" element={<RequireSuperAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminPlatformPage /></AdminShell></RequireSuperAdmin>} />

          <Route path="/admin/team" element={<RequireSuperAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminTeamPage /></AdminShell></RequireSuperAdmin>} />

          <Route path="/admin/audit-log" element={<RequireSuperAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminAuditLogPage /></AdminShell></RequireSuperAdmin>} />

          <Route path="/admin/recovery-cases" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminRecoveryCasesPage /></AdminShell></RequireAdmin>} />

          <Route path="/admin/liabilities" element={<RequireAdmin {...guardProps}><AdminShell isSuperAdmin={isSuperAdmin}><AdminLiabilitiesPage /></AdminShell></RequireAdmin>} />

          <Route path="/checkout/payment-return" element={<RequireRole role="CONSUMER" {...guardProps}><PaymentReturnPage userName={userName} /></RequireRole>} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
