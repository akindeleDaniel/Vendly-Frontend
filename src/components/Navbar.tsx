import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

type NavbarProps = {
    isLoggedIn : boolean
    userRole: "CONSUMER" | "SELLER" | null
    onLogout: () => Promise<void>
}

function Navbar ({isLoggedIn, userRole, onLogout}: NavbarProps){

    const {pathname} = useLocation()
    const navigate = useNavigate()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [logoutError, setLogoutError] = useState("")

    async function handleLogout() {
        setIsLoggingOut(true)
        setLogoutError("")

        try {
            await onLogout()
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

    return(
        <nav>
            {
                isLoggedIn ? (
                    <>
                        {userRole === "CONSUMER" && pathname !== "/cart" && <Link to={"/cart"}>Cart</Link>}
                        <Link to={"/seller/myListing"}>Profile</Link>
                        <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
                            {isLoggingOut ? "Logging out..." : "Logout"}
                        </button>
                        {logoutError && <p role="alert">{logoutError}</p>}
                    </>
                ) : (
                    <>
                        {pathname !== "/" && <Link to={"/"}>Home</Link>}
                        {pathname !== "/register" && <Link to={"/register"}>Register</Link>}
                        {pathname !== "/login" && <Link to={"/login"}>Login</Link>}
                    </>
                )
            }
        </nav>
    )
}

export default Navbar