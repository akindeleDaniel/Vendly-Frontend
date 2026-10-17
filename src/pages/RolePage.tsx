import { Link, useNavigate } from "react-router-dom"
import { useDocumentTitle } from "../lib/useDocumentTitle"

function RolePage(){
    const navigate = useNavigate()
    useDocumentTitle("Choose an account type")
    function handleConsumerClick(){
        navigate("/consumer/register")
    }
    function handleSellerClick(){
        navigate("/seller/register")
    }

    return(
        <div className="form-page">
            <h1>Create an account</h1>
            <p>How would you like to use Vendly?</p>
            <div className="role-options">
                <button type="button" className="role-card" onClick={handleConsumerClick}>
                    <span className="role-card-title">I want to shop</span>
                    <span className="role-card-text">Browse products, add them to your cart and check out.</span>
                </button>
                <button type="button" className="role-card" onClick={handleSellerClick}>
                    <span className="role-card-title">I want to sell</span>
                    <span className="role-card-text">Open a store, add your listings and reach shoppers.</span>
                </button>
            </div>
            <p className="form-footer">Already have an account? <Link to="/login">Log in</Link></p>
        </div>
    )
}

export default RolePage
