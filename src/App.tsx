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
import { useEffect, useState } from "react"

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)// starts with true since it is still checking

  useEffect(() => { // the reason we have a function in the use effect is because useEffect doesn't allow the use of async in it so we havve to create a function that accepts it
    async function checkAuth() {
      const response = await fetch("http://localhost:3000/users/check",{
        credentials:"include"
      })
      
      if(response.ok){
        setIsLoggedIn(true)
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [] //this empty array bracket says that the function should run just once when the frontend renders starts
  )

  return (
    <BrowserRouter>
      <Navbar isLoggedIn = {isLoggedIn} />
      <Routes>
        <Route path="/" element={<DiscoveryPage/>} />

        <Route path="/register" element={<RolePage />} />

        <Route path="/consumer/register" element={<RegisterPage setIsLoggedIn={setIsLoggedIn} role="CONSUMER"/>} />

        <Route path="/seller/register" element={<RegisterPage setIsLoggedIn={setIsLoggedIn} role="SELLER"/>} />

        <Route path="/login" element={<LoginPage setIsLoggedIn = {setIsLoggedIn}/>} />

        <Route path="/consumer/discover" element={<DiscoveryPage/>} />

        <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />

        <Route path="/seller/profile/edit" element={<EditSellerProfilePage />} />

        <Route path="/seller/myListing" element={<MyListingPage isLoggedIn ={isLoggedIn} isLoading = {isLoading}/>}/>

        <Route path="/shop/:slug" element={<ShopPage/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;