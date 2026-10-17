import { useState } from "react"
import { Link } from "react-router-dom"
import { readPendingCartItem } from "../lib/pendingCartItem"
import type { UserRole } from "../types/user"
import { apiFetch, getErrorMessage } from "../lib/api"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import Notice from "../components/Notice"
import Logo from "../components/Logo"

type ExistingUser = {
    email: string
    password: string
}

type LoginPageProps = {
    onLogin: (role: UserRole) => void
    sessionExpired: boolean
}

function LoginPage ({onLogin, sessionExpired}: LoginPageProps){

    const [formData, setFormData] = useState<ExistingUser>({
        email: "",
        password: ""
    })
    useDocumentTitle("Log in")
    const loginPrompt = readPendingCartItem() ? "Log in or register to add this item to your cart." : ""
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (isSubmitting) {
            return
        }

        if (formData.email === "" || formData.password === "") {
            setError("All areas must be filled")
            return
        }

        setIsSubmitting(true)
        setError("")

        try{
            const response = await apiFetch("/users/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData
                }),
                credentials:"include"
            })

            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to log in (status ${response.status}).`))
                return
            }

            const data: unknown = await response.json().catch(() => null)
            const role = typeof data === "object" && data !== null && "role" in data ? data.role : null

            if(role !== "CONSUMER" && role !== "SELLER") {
                setError("Unable to determine account role. Please try again.")
                return
            }

            // Updating the session state is enough: the route guard sends the user to their home page,
            // and sellers without a store profile are sent on to onboarding from there.
            onLogin(role)
        }catch {
            setError("Something went wrong. Please check your connection and try again.")
        }finally{
            setIsSubmitting(false)
        }
    }

    return(
        <div className="form-page">
            <div className="auth-brand"><Logo size="large" /></div>
            <h1>Log in</h1>
            {sessionExpired && <Notice kind="info">Your session has expired. Please log in again.</Notice>}
            {loginPrompt && !sessionExpired && <Notice kind="info">{loginPrompt}</Notice>}
            <form onSubmit={handleSubmit} className="card form-card">
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
                        autoComplete="current-password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn-block btn-lg" disabled={isSubmitting}>{isSubmitting ? "Logging in..." : "Log in"}</button>
            </form>
            <p className="form-footer">Don't have an account? <Link to={"/register"}>Register</Link></p>
        </div>
    )
}

export default LoginPage
