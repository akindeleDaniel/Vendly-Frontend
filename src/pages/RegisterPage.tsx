import { useState } from "react"
import { Link } from "react-router-dom"
import { readPendingCartItem } from "../lib/pendingCartItem"
import type { UserRole } from "../types/user"
import { apiFetch, getErrorMessage } from "../lib/api"

type User = {
    name: string
    email: string
    password: string
}

type RegisterPageProps = {
    onLogin: (role: UserRole) => void
    role: UserRole
}

function RegisterPage ({onLogin, role}: RegisterPageProps){

    const [formData, setFormData] = useState<User>({
        name:"",
        email: "",
        password: ""
    })
    const registerPrompt = role === "CONSUMER" && readPendingCartItem() ? "Create a shopper account to add this item to your cart." : ""
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (isSubmitting) {
            return
        }

        if (formData.name === "" || formData.email === "" || formData.password === "") {
            setError("All areas must be filled")
            return
        }

        setIsSubmitting(true)
        setError("")

        try{
            const response = await apiFetch("/users/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData,
                    role
                }),
                credentials: "include"
            })

            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to register (status ${response.status}).`))
                return
            }

            // Registration logs the user in. The route guard then sends consumers to the home page
            // and sellers to their store page, which starts onboarding when no store profile exists.
            onLogin(role)
        }catch{
             setError("Something went wrong. Please check your connection and try again.")
        }finally{
            setIsSubmitting(false)
        }
    }

    return(
        <>
            {registerPrompt && <p role="status">{registerPrompt}</p>}
            <form onSubmit={handleSubmit}>
            <label>
            Name
            <input name="name"
                autoComplete="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
            </label>
            <label>
            Email
            <input name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
            </label>
            <label>
            Password
            <input name="password"
            type="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Registering..." : "Register"}</button>
        </form>
        <p>Already have an account? <Link to={"/login"}>Login</Link></p>
        </>
    )
}

export default RegisterPage
