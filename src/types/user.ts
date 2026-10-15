export type UserRole = "CONSUMER" | "SELLER"

// "error" means the session check itself failed (network or server error), which is not
// proof that the user is logged out.
export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error"
