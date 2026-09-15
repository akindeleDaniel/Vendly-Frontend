import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import RegisterPage from "./RegisterPage";
import LoginPage from "./LoginPage";
import { useEffect, useState } from "react";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => { // the reason we have a function in the use effect is because useEffect doesn't allow the use of async in it so we havve to create a function that accepts it
    async function checkAuth() {
      const response = await fetch("http://localhost:3000/users/check",{
        credentials:"include"
      })
      
      if(response.ok){
        setIsLoggedIn(true)
      }
    }
    checkAuth()
  }, [] //this say that the function should run just once when the server starts
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage isLoggedIn ={isLoggedIn}/>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage setIsLoggedIn = {setIsLoggedIn}/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;