import { BrowserRouter, Routes, Route } from "react-router-dom"
import RegisterPage from "./RegisterPage"
import WelcomePage from "./WelcomePage"
import LoginPage from "./LoginPage"
import RolePage from "./RolePage"
import HomePage from "./DiscoveryPage"
import MyListingPage from "./MyListingPage"
import SellerOnboardingPage from "./SellerOnboardingPage"
import EditSellerProfilePage from "./EditSellerProfilePage"
import Navbar from "./Navbar"
import ShopPage from "./ShopPage"
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
        <Route path="/" element={<WelcomePage/>} />

        <Route path="/register" element={<RolePage />} />

        <Route path="/consumer/register" element={<RegisterPage setIsLoggedIn={setIsLoggedIn} role="CONSUMER"/>} />

        <Route path="/seller/register" element={<RegisterPage setIsLoggedIn={setIsLoggedIn} role="SELLER"/>} />

        <Route path="/login" element={<LoginPage setIsLoggedIn = {setIsLoggedIn}/>} />

        <Route path="/consumer/discover" element={<HomePage/>} />

        <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />

        <Route path="/seller/profile/edit" element={<EditSellerProfilePage />} />

        <Route path="/seller/myListing" element={<MyListingPage isLoggedIn ={isLoggedIn} isLoading = {isLoading}/>}/>

        <Route path="/shop/:slug" element={<ShopPage/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;