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
import { RedirectIfAuthenticated, RequireRole } from "./components/RouteGuards"
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
  const [sessionExpired, setSessionExpired] = useState(false)
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0)
  const authStatusRef = useRef<AuthStatus>("loading")

  useEffect(() => {
    authStatusRef.current = authStatus
  }, [authStatus])

  function handleLogin(role: UserRole) {
    if (role !== "CONSUMER") {
      clearPendingCartItem()// only a shopper can complete a remembered add-to-cart
    }
    setUserRole(role)
    setAuthStatus("authenticated")
    setSessionExpired(false)
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

  const guardProps = { authStatus, userRole, onRetry: retryAuthCheck }

  return (
    <BrowserRouter>
      <SkipLink />
      <ScrollToTop />
      <Navbar authStatus={authStatus} userRole={userRole} onLogout={handleLogout} />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<DiscoveryPage userRole={userRole} />} />

          <Route path="/register" element={<RedirectIfAuthenticated {...guardProps}><RolePage /></RedirectIfAuthenticated>} />

          <Route path="/consumer/register" element={<RedirectIfAuthenticated {...guardProps}><RegisterPage onLogin={handleLogin} role="CONSUMER"/></RedirectIfAuthenticated>} />

          <Route path="/seller/register" element={<RedirectIfAuthenticated {...guardProps}><RegisterPage onLogin={handleLogin} role="SELLER"/></RedirectIfAuthenticated>} />

          <Route path="/login" element={<RedirectIfAuthenticated {...guardProps}><LoginPage onLogin={handleLogin} sessionExpired={sessionExpired}/></RedirectIfAuthenticated>} />

          <Route path="/seller/onboarding" element={<RequireRole role="SELLER" {...guardProps}><SellerOnboardingPage /></RequireRole>} />

          <Route path="/seller/profile/edit" element={<RequireRole role="SELLER" {...guardProps}><EditSellerProfilePage /></RequireRole>} />

          <Route path="/seller/payouts" element={<RequireRole role="SELLER" {...guardProps}><PayoutSettingsPage /></RequireRole>} />

          <Route path="/seller/myListing" element={<RequireRole role="SELLER" {...guardProps}><MyListingPage /></RequireRole>} />

          <Route path="/shop/:slug" element={<ShopPage userRole={userRole} authStatus={authStatus} />} />

          <Route path="/cart" element={<RequireRole role="CONSUMER" {...guardProps}><CartPage /></RequireRole>} />

          <Route path="/checkout" element={<RequireRole role="CONSUMER" {...guardProps}><CheckoutPage /></RequireRole>} />

          <Route path="/checkout/payment-return" element={<RequireRole role="CONSUMER" {...guardProps}><PaymentReturnPage /></RequireRole>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
