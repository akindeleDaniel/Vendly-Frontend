import { useNavigate } from "react-router-dom"

function RolePage(){
    const navigate = useNavigate()
    function handleConsumerClick(){
        navigate("/consumer/register")
    }
    function handleSellerClick(){
        navigate("/seller/register")
    }

    return(
        <div>
            <h1>Select Role</h1>
            <button onClick={handleConsumerClick}>Consumer</button>
            <button onClick={handleSellerClick}>Seller</button>
        </div>
    )
}

export default RolePage