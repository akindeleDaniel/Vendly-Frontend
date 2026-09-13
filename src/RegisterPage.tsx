import { useState } from "react"

type User = {
    name: string
    email: string
    password: string
}

function RegisterPage (){
    const [formData, setFormData] = useState<User>({
        name:"",
        email: "",
        password: ""
    })
    
    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (formData.name === "" || formData.email === "" || formData.password === "") {
            alert("All areas must be filled")
            return
        }

        try{
            const response = await fetch("http://localhost:3000/users/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData
                }),
            })
    
            const data = await response.json()
    
            if (!response.ok) {
                alert(data.message) 
                return
            }
    
            setFormData({
                name: "",
                email: "",
                password: ""
            })

        }catch(error){
             alert("Something went wrong. Please check your connection and try again.")
        }
    }

    return(
        <>
            <form onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
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
        <button type="submit">Register</button>
      </form>
        </>
    )
}

export default RegisterPage