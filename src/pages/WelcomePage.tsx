import { useNavigate } from "react-router-dom";

function WelcomePage(){
    const navigate = useNavigate()
    function handleLoginClick(){
        navigate("/login")
    }

    return(
        <div>
            <h1>Vendly</h1>
            <button onClick={handleLoginClick}>Login</button>
        </div>
    )
} 

export default WelcomePage