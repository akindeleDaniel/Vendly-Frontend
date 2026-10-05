import { Link, useLocation } from "react-router-dom"

type NavbarProps = {
    isLoggedIn : boolean
    userRole: "CONSUMER" | "SELLER" | null
}

function Navbar ({isLoggedIn, userRole}: NavbarProps){

    const {pathname} = useLocation()

    return(
        <nav>
            {
                isLoggedIn ? (
                    <>
                        {userRole === "CONSUMER" && pathname !== "/cart" && <Link to={"/cart"}>Cart</Link>}
                        <Link to={"/seller/myListing"}>Profile</Link>
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