import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import type { AuthStatus, UserRole } from "../types/user"

type NavbarProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
    onLogout: () => Promise<void>
}

function Navbar ({authStatus, userRole, onLogout}: NavbarProps){

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

    // Account links are not shown until the session check has finished, so the wrong links never flash.
    if (authStatus === "loading") {
        return <nav aria-busy="true" />
    }

    return(
        <nav>
            {pathname !== "/" && <Link to={"/"}>Home</Link>}
            {
                authStatus === "authenticated" ? (
                    <>
                        {userRole === "CONSUMER" && pathname !== "/cart" && <Link to={"/cart"}>Cart</Link>}
                        {userRole === "SELLER" && pathname !== "/seller/myListing" && <Link to={"/seller/myListing"}>My store</Link>}
                        <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
                            {isLoggingOut ? "Logging out..." : "Logout"}
                        </button>
                        {logoutError && <p role="alert">{logoutError}</p>}
                    </>
                ) : (
                    <>
                        {pathname !== "/register" && <Link to={"/register"}>Register</Link>}
                        {pathname !== "/login" && <Link to={"/login"}>Login</Link>}
                    </>
                )
            }
        </nav>
    )
}

export default Navbar
