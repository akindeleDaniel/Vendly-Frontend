import { useState } from "react"
import { Link } from "react-router-dom"
import { readPendingCartItem } from "../lib/pendingCartItem"
import type { UserRole } from "../types/user"
import { apiFetch, getErrorMessage } from "../lib/api"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import Notice from "../components/Notice"
import Logo from "../components/Logo"
import { ChevronLeftIcon } from "../components/Icons"

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
    useDocumentTitle(role === "SELLER" ? "Create a seller account" : "Create an account")
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
        <div className="form-page">
            <div className="auth-brand"><Logo size="large" /></div>
            <h1>{role === "SELLER" ? "Create a seller account" : "Create a shopper account"}</h1>
            {registerPrompt && <Notice kind="info">{registerPrompt}</Notice>}
            <form onSubmit={handleSubmit} className="card form-card">
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
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn-block btn-lg" disabled={isSubmitting}>{isSubmitting ? "Registering..." : "Create account"}</button>
            </form>
            <p className="form-footer">Already have an account? <Link to={"/login"}>Log in</Link></p>
            <p className="form-footer">
                <Link to="/" className="back-link"><ChevronLeftIcon /> Back to home</Link>
            </p>
        </div>
    )
}

export default RegisterPage
