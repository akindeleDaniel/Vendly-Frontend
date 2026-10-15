import { useState } from "react"
import { Link } from "react-router-dom"
import { readPendingCartItem } from "../lib/pendingCartItem"
import type { UserRole } from "../types/user"
import { apiFetch, getErrorMessage } from "../lib/api"

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
        <>
            {sessionExpired && <p role="status">Your session has expired. Please log in again.</p>}
            {loginPrompt && !sessionExpired && <p role="status">{loginPrompt}</p>}
            <form onSubmit={handleSubmit}>
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
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Logging in..." : "Login"}</button>
        </form>
        <p>Don't have an account? <Link to={"/register"}>Register</Link></p>
        </>
    )
}

export default LoginPage
