import { useState } from "react"
import { useNavigate } from "react-router-dom"

type ExistingUser = {
    email: string
    password: string
}

function LoginPage (){

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

            navigate("/")
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
          value={formData.password}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <button type="submit">Login</button>
      </form>
        </>
    )
}

export default LoginPage