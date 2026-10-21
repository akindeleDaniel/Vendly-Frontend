import { useState } from "react"
import { googleSignIn } from "./accountApi"
import type { UserRole } from "../types/user"

// What Google sign-in needs next after the token has been sent.
export type GoogleStep =
    | { kind: "role", credential: string, name: string, email: string }// a new person: buyer or seller?
    | { kind: "link", credential: string, email: string }// an account with this email exists: enter the emailed code
    | { kind: "otp", email: string }// an administrator: enter the emailed code

export type GoogleSignIn = ReturnType<typeof useGoogleSignIn>

// The Google sign-in flow for the login and registration pages. A registration page already knows
// whether the person is a buyer or a seller (`fixedRole`); the login page asks only if the backend
// says the person is new. The Google token is kept in memory only and is valid for about an hour.
export function useGoogleSignIn(onLogin: (role: UserRole) => void, fixedRole?: UserRole) {
    const [step, setStep] = useState<GoogleStep | null>(null)
    const [error, setError] = useState("")
    const [isWorking, setIsWorking] = useState(false)

    async function submit(credential: string, role?: UserRole) {
        setIsWorking(true)
        setError("")
        const outcome = await googleSignIn(credential, role)
        setIsWorking(false)

        switch (outcome.kind) {
            case "logged-in":
                onLogin(outcome.role)
                break
            case "role-required":
                setStep({ kind: "role", credential, name: outcome.name, email: outcome.email })
                break
            case "link-required":
                setStep({ kind: "link", credential, email: outcome.email })
                break
            case "otp-required":
                setStep({ kind: "otp", email: outcome.email })
                break
            case "error":
                setError(outcome.message)
                break
        }
    }

    return {
        step,
        error,
        isWorking,
        onLogin,
        handleCredential: (credential: string) => submit(credential, fixedRole),
        chooseRole: (role: UserRole) => {
            if (step?.kind === "role") {
                void submit(step.credential, role)
            }
        },
        reset: () => {
            setStep(null)
            setError("")
        }
    }
}
