import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"

type ExistingUser = {
    email: string
    password: string
}

type LoginPageProps = {
    setIsLoggedIn : (value: boolean) => void
}

function LoginPage ({setIsLoggedIn}: LoginPageProps){

    const navigate = useNavigate()

    const [formData, setFormData] = useState<ExistingUser>({
        email: "",
        password: ""
    })
    
    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (formData.email === "" || formData.password === "") {
            alert("All areas must be filled")
            return
        }

        try{
            const response = await fetch("http://localhost:3000/users/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData
                }),
                credentials:"include"
            })
    
            const data = await response.json()

            
            if (!response.ok) {
                alert(data.message) 
                return
            }
            
            setFormData({
                email: "",
                password: ""
            })
            setIsLoggedIn(true)
                        
            if(data.role === "CONSUMER"){
                navigate("/consumer/discover")
            }else if(data.role === "SELLER"){
                const profileResponse = await fetch("http://localhost:3000/seller/profile", {
                    credentials: "include"
                })

                if (profileResponse.ok){
                    navigate("/seller/myListing")
                }else if(profileResponse.status === 404){
                    navigate("/seller/onboarding")
                }else{
                    alert("You are logged in, but we could not load your store details. Please try logging in again.")
                    return
                }              
            }
            
        }catch(error){
            alert("Something went wrong. Please check your connection and try again.")
        }
    }

    return(
        <>
            <form onSubmit={handleSubmit}>
            <label>
            Email
            <input name="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
            </label>
            <label>
            Password
            <input name="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
            </label>
            <button type="submit">Login</button>
        </form>
        <p>Don't have an account? <Link to={"/register"}>Register</Link></p>
        </>
    )
}

export default LoginPage