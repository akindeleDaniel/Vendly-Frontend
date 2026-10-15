import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import type { AuthStatus, UserRole } from "../types/user"

// Frontend guards only improve the user experience. The backend enforces authentication
// and authorization on every protected endpoint.

type GuardProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
    onRetry: () => void
    children: ReactNode
}

function homePathForRole(role: UserRole | null): string {
    return role === "SELLER" ? "/seller/myListing" : "/"
}

function SessionLoading() {
    return <p role="status">Checking your session...</p>
}

export function RequireRole({ role, authStatus, userRole, onRetry, children }: GuardProps & { role: UserRole }) {
    if (authStatus === "loading") {
        return <SessionLoading />
    }

    if (authStatus === "error") {
        return (
            <div role="alert">
                <p>We could not verify your session. Please check your connection and try again.</p>
                <button type="button" onClick={onRetry}>Try again</button>
            </div>
        )
    }

    if (authStatus === "unauthenticated") {
        return <Navigate to="/login" replace />
    }

    if (userRole !== role) {
        return <Navigate to={homePathForRole(userRole)} replace />
    }

    return <>{children}</>
}

// For login and registration pages: signed-in users are sent to their home page instead.
export function RedirectIfAuthenticated({ authStatus, userRole, children }: Omit<GuardProps, "onRetry">) {
    if (authStatus === "loading") {
        return <SessionLoading />
    }

    if (authStatus === "authenticated") {
        return <Navigate to={homePathForRole(userRole)} replace />
    }

    return <>{children}</>
}
