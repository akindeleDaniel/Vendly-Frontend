import { BrowserRouter, Routes, Route } from "react-router-dom"
import RegisterPage from "./pages/RegisterPage"
import LoginPage from "./pages/LoginPage"
import RolePage from "./pages/RolePage"
import DiscoveryPage from "./pages/DiscoveryPage"
import MyListingPage from "./pages/MyListingPage"
import SellerOnboardingPage from "./pages/SellerOnboardingPage"
import EditSellerProfilePage from "./pages/EditSellerProfilePage"
import Navbar from "./components/Navbar"
import ShopPage from "./pages/ShopPage"
import CartPage from "./pages/CartPage"
import { useEffect, useState } from "react"

type UserRole = "CONSUMER" | "SELLER"

function isUserRole(value: unknown): value is UserRole {
  return value === "CONSUMER" || value === "SELLER"
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)// starts with true since it is still checking

  useEffect(() => { // the reason we have a function in the use effect is because useEffect doesn't allow the use of async in it so we havve to create a function that accepts it
    async function checkAuth() {
      try {
        const response = await fetch("http://localhost:3000/users/check", {
          credentials: "include"
        })

        if (!response.ok) {
          setIsLoggedIn(false)
          setUserRole(null)
          return
        }

        const data: unknown = await response.json()
        if (typeof data === "object" && data !== null && "role" in data && isUserRole(data.role)) {
          setIsLoggedIn(true)
          setUserRole(data.role)
        } else {
          setIsLoggedIn(false)
          setUserRole(null)
        }
      } catch (error) {
        console.error("Unable to check authentication:", error)
        setIsLoggedIn(false)
        setUserRole(null)
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [] //this empty array bracket says that the function should run just once when the frontend renders starts
  )

  return (
    <BrowserRouter>
      <Navbar isLoggedIn={isLoggedIn} userRole={userRole} />
      <Routes>
        <Route path="/" element={<DiscoveryPage/>} />

        <Route path="/register" element={<RolePage />} />

        <Route path="/consumer/register" element={<RegisterPage setIsLoggedIn={setIsLoggedIn} setUserRole={setUserRole} role="CONSUMER"/>} />

        <Route path="/seller/register" element={<RegisterPage setIsLoggedIn={setIsLoggedIn} setUserRole={setUserRole} role="SELLER"/>} />

        <Route path="/login" element={<LoginPage setIsLoggedIn={setIsLoggedIn} setUserRole={setUserRole}/>} />

        <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />

        <Route path="/seller/profile/edit" element={<EditSellerProfilePage />} />

        <Route path="/seller/myListing" element={<MyListingPage isLoggedIn={isLoggedIn} isLoading={isLoading} userRole={userRole}/>}/>

        <Route path="/shop/:slug" element={<ShopPage/>} />

        <Route path="/cart" element={<CartPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;