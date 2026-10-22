import { apiRequest, failureMessage, isRecord } from "./apiRequest"
import type { UserRole } from "../types/user"

export type CodePurpose = "VERIFY_EMAIL" | "LOGIN"

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_BYTES = 72

// Mirrors the backend's first two password rules so most mistakes are caught before sending. The
// backend also refuses common passwords and passwords equal to the email or name, and its message
// is shown for those.
export function checkPassword(password: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    }

    if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
        return `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer`
    }

    return null
}

function readRole(data: unknown): UserRole | null {
    if (isRecord(data) && (data.role === "CONSUMER" || data.role === "SELLER")) {
        return data.role
    }

    return null
}

type Failed = Exclude<Awaited<ReturnType<typeof apiRequest<unknown>>>, { kind: "ok" }>

// Any failure: the message to show and, after a "too many attempts" answer, how many seconds to wait.
export type ErrorOutcome = { kind: "error", message: string, retryAfterSeconds?: number }

function errorOf(result: Failed): ErrorOutcome {
    return {
        kind: "error",
        message: failureMessage(result),
        ...(result.kind === "failed" && result.retryAfterSeconds !== null ? { retryAfterSeconds: result.retryAfterSeconds } : {})
    }
}

export type GoogleOutcome =
    | { kind: "logged-in", role: UserRole, isNewAccount: boolean }
    | { kind: "role-required", name: string, email: string }// a new person: ask buyer or seller, then send the same token again
    | { kind: "link-required", email: string }// an account with this email exists: a code was emailed to link Google to it
    | { kind: "otp-required", email: string }// an administrator, who always enters an emailed code
    | ErrorOutcome

// Signs in (or signs up) with the token Google's button gives the browser. The backend checks the
// token itself. `role` is only needed for someone new.
export async function googleSignIn(credential: string, role?: UserRole): Promise<GoogleOutcome> {
    const result = await apiRequest<unknown>("/users/google", {
        method: "POST",
        body: role ? { credential, role } : { credential }
    })

    if (result.kind !== "ok") {
        return errorOf(result)
    }

    const data = result.data
    const loggedInRole = readRole(data)

    if (loggedInRole) {
        return { kind: "logged-in", role: loggedInRole, isNewAccount: isRecord(data) && data.isNewAccount === true }
    }

    if (isRecord(data) && data.roleRequired === true) {
        return {
            kind: "role-required",
            name: typeof data.name === "string" ? data.name : "",
            email: typeof data.email === "string" ? data.email : ""
        }
    }

    if (isRecord(data) && data.linkRequired === true) {
        return { kind: "link-required", email: typeof data.email === "string" ? data.email : "" }
    }

    if (isRecord(data) && data.otpRequired === true) {
        return { kind: "otp-required", email: typeof data.email === "string" ? data.email : "" }
    }

    return { kind: "error", message: "We received an unexpected response from the server. Please try again." }
}

// Finishes linking Google to an existing account with the code that was emailed. A correct code logs
// the person in.
export async function googleLink(credential: string, code: string): Promise<VerifyOutcome> {
    const result = await apiRequest<unknown>("/users/google/link", { method: "POST", body: { credential, code } })

    if (result.kind !== "ok") {
        return errorOf(result)
    }

    const role = readRole(result.data)
    return role ? { kind: "ok", role } : { kind: "error", message: "Unable to determine account role. Please try again." }
}

export type RegisterOutcome =
    | { kind: "code-sent", email: string }
    | ErrorOutcome

// Registering does not log anyone in: the backend emails a 6-digit code that must be entered first.
export async function registerAccount(input: { name: string, email: string, password: string, role: UserRole }): Promise<RegisterOutcome> {
    const result = await apiRequest<unknown>("/users/register", { method: "POST", body: input })

    if (result.kind !== "ok") {
        return errorOf(result)
    }

    const email = isRecord(result.data) && typeof result.data.email === "string" ? result.data.email : input.email.trim().toLowerCase()
    return { kind: "code-sent", email }
}

export type LoginOutcome =
    | { kind: "logged-in", role: UserRole }// a browser the backend already trusts
    | { kind: "code-required", email: string }// a code was emailed
    | { kind: "unverified", email: string }// the sign-up email was never confirmed; a code was emailed
    | ErrorOutcome

export async function logIn(email: string, password: string): Promise<LoginOutcome> {
    const result = await apiRequest<unknown>("/users/login", { method: "POST", body: { email, password } })

    if (result.kind === "ok") {
        const role = readRole(result.data)

        if (role) {
            return { kind: "logged-in", role }
        }

        if (isRecord(result.data) && result.data.otpRequired === true) {
            return { kind: "code-required", email: typeof result.data.email === "string" ? result.data.email : email.trim().toLowerCase() }
        }

        return { kind: "error", message: "We received an unexpected response from the server. Please try again." }
    }

    if (result.kind === "failed" && result.status === 403 && result.code === "EMAIL_NOT_VERIFIED") {
        const bodyEmail = isRecord(result.body) && typeof result.body.email === "string" ? result.body.email : null
        return { kind: "unverified", email: bodyEmail ?? email.trim().toLowerCase() }
    }

    return errorOf(result)
}

export type VerifyOutcome =
    | { kind: "ok", role: UserRole }
    | ErrorOutcome

// Checks a 6-digit code. A correct code logs the person in on this device.
export async function verifyCode(purpose: CodePurpose, email: string, code: string): Promise<VerifyOutcome> {
    const path = purpose === "LOGIN" ? "/users/login/verify" : "/users/verify-email"
    const result = await apiRequest<unknown>(path, { method: "POST", body: { email, code } })

    if (result.kind !== "ok") {
        return errorOf(result)
    }

    const role = readRole(result.data)
    return role ? { kind: "ok", role } : { kind: "error", message: "Unable to determine account role. Please try again." }
}

export type MessageOutcome =
    | { kind: "ok", message: string }
    | ErrorOutcome

function readMessage(data: unknown, fallback: string): string {
    return isRecord(data) && typeof data.message === "string" && data.message ? data.message : fallback
}

// The answer is the same for every address, so this never reveals whether an account exists.
export async function resendCode(purpose: CodePurpose, email: string): Promise<MessageOutcome> {
    const result = await apiRequest<unknown>("/users/resend-code", { method: "POST", body: { email, purpose } })
    return result.kind === "ok" ? { kind: "ok", message: readMessage(result.data, "If that account needs a code, we have emailed one.") } : errorOf(result)
}

export async function requestPasswordReset(email: string): Promise<MessageOutcome> {
    const result = await apiRequest<unknown>("/users/forgot-password", { method: "POST", body: { email } })
    return result.kind === "ok" ? { kind: "ok", message: readMessage(result.data, "If an account exists for that email, we have sent a code.") } : errorOf(result)
}

// Every login and trusted device of the account ends, and nobody is logged in afterwards.
export async function resetPassword(email: string, code: string, newPassword: string): Promise<MessageOutcome> {
    const result = await apiRequest<unknown>("/users/reset-password", { method: "POST", body: { email, code, newPassword } })
    return result.kind === "ok" ? { kind: "ok", message: readMessage(result.data, "Your password has been changed.") } : errorOf(result)
}

// For an account made with Google, which has no password yet: emails a code to confirm it is them.
export async function sendSetPasswordCode(): Promise<MessageOutcome> {
    const result = await apiRequest<unknown>("/users/set-password/send-code", { method: "POST", body: {} })
    return result.kind === "ok" ? { kind: "ok", message: readMessage(result.data, "We have emailed you a code.") } : errorOf(result)
}

// Adds a password to an account that has none. This device stays logged in; every other device is logged out.
export async function setPassword(code: string, newPassword: string): Promise<MessageOutcome> {
    const result = await apiRequest<unknown>("/users/set-password", { method: "POST", body: { code, newPassword } })
    return result.kind === "ok" ? { kind: "ok", message: readMessage(result.data, "Your password has been set.") } : errorOf(result)
}

// The person stays logged in on this device; every other device is logged out.
export async function changePassword(currentPassword: string, newPassword: string): Promise<MessageOutcome> {
    const result = await apiRequest<unknown>("/users/change-password", { method: "POST", body: { currentPassword, newPassword } })
    return result.kind === "ok" ? { kind: "ok", message: readMessage(result.data, "Your password has been changed.") } : errorOf(result)
}
