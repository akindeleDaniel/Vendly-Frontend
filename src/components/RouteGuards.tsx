import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { readPendingCartItem } from "../lib/pendingCartItem"
import type { AuthStatus, UserRole } from "../types/user"

// Frontend guards only improve the user experience. The backend enforces authentication
// and authorization on every protected endpoint.

type GuardProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
    isAdmin?: boolean
    isSuperAdmin?: boolean
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

// Pages for any signed-in person, whatever their role.
export function RequireSession({ authStatus, onRetry, children }: GuardProps) {
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

    return <>{children}</>
}

// Administrator pages. Whether someone is an administrator comes from the session check, but only
// to decide what to show: the backend checks it again on every administrator request.
export function RequireAdmin({ authStatus, userRole, isAdmin, onRetry, children }: GuardProps) {
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

    if (!isAdmin) {
        return <Navigate to={homePathForRole(userRole)} replace />
    }

    return <>{children}</>
}

// Pages for super administrators only (the platform figures, the team and the audit log). As with
// RequireAdmin, the session check only decides what to show: the backend checks it on every request.
export function RequireSuperAdmin({ authStatus, userRole, isAdmin, isSuperAdmin, onRetry, children }: GuardProps) {
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

    if (!isAdmin) {
        return <Navigate to={homePathForRole(userRole)} replace />
    }

    if (!isSuperAdmin) {
        return <Navigate to="/admin" replace />
    }

    return <>{children}</>
}

// For login and registration pages: signed-in users are sent to their home page instead.
export function RedirectIfAuthenticated({ authStatus, userRole, children }: Omit<GuardProps, "onRetry">) {
    if (authStatus === "loading") {
        return <SessionLoading />
    }

    if (authStatus === "authenticated") {
        // A consumer who was asked to log in from a storefront goes back there; the storefront
        // then adds the product they chose.
        const pendingCartItem = userRole === "CONSUMER" ? readPendingCartItem() : null
        if (pendingCartItem) {
            return <Navigate to={pendingCartItem.returnTo} replace />
        }

        return <Navigate to={homePathForRole(userRole)} replace />
    }

    return <>{children}</>
}
