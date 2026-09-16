import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import RegisterPage from "./RegisterPage";
import LoginPage from "./LoginPage";
import MyListingPage from "./MyListingPage"
import { useEffect, useState } from "react";

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
      <Routes>
        <Route path="/" element={<HomePage/>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage setIsLoggedIn = {setIsLoggedIn}/>} />
        <Route path="/myListing" element={<MyListingPage isLoggedIn ={isLoggedIn} isLoading = {isLoading}/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;