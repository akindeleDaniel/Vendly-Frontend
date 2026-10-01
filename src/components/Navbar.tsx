import { Link, useLocation } from "react-router-dom"

type NavbarProps = {
    isLoggedIn : boolean
}

function Navbar ({isLoggedIn}: NavbarProps){

    const {pathname} = useLocation()

    return(
        <nav>
            {
                isLoggedIn ? (
                    <Link to={"/seller/myListing"}>Profile</Link>
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