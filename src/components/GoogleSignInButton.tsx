import { useEffect, useRef, useState } from "react"
import { getGoogleClientId, loadGoogleScript } from "../lib/googleScript"

type GoogleSignInButtonProps = {
    // Called with Google's sign-in token when the person finishes choosing a Google account.
    onCredential: (credential: string) => void
    disabled?: boolean
    // Google's own wording: "Continue with Google" or, on the sign-up page, "Sign up with Google".
    text?: "continue_with" | "signup_with"
}

// Google only issues its sign-in token through its own button, so this draws that button in the
// style the rest of the page uses (outlined, rectangular, "Continue with Google", full width) and
// leaves the rest to Google. It is hidden when the site has no Google client id, or when Google's
// script cannot load.
function GoogleSignInButton({ onCredential, disabled, text = "continue_with" }: GoogleSignInButtonProps) {
    const clientId = getGoogleClientId()
    const wrapRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLDivElement>(null)
    const callbackRef = useRef(onCredential)
    const [isReady, setIsReady] = useState(false)
    const [hasFailed, setHasFailed] = useState(false)

    // Google keeps the first callback it is given, so it calls this one, which always reaches the latest.
    useEffect(() => {
        callbackRef.current = onCredential
    })

    useEffect(() => {
        if (!clientId) {
            return
        }

        let isCancelled = false

        loadGoogleScript()
            .then(() => {
                if (isCancelled || !window.google) {
                    return
                }

                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: (response) => callbackRef.current(response.credential)
                })
                setIsReady(true)
            })
            .catch(() => {
                if (!isCancelled) {
                    setHasFailed(true)
                }
            })

        return () => {
            isCancelled = true
        }
    }, [clientId])

    // Google draws the button at a fixed width (200 to 400 pixels), so it is drawn again when the
    // space around it changes, for example when a phone is turned.
    useEffect(() => {
        const wrap = wrapRef.current
        const target = buttonRef.current

        if (!isReady || !wrap || !target) {
            return
        }

        let lastWidth = 0

        function draw() {
            const google = window.google
            const width = Math.min(400, Math.max(200, Math.floor(wrap!.clientWidth)))

            if (!google || width === lastWidth) {
                return
            }

            lastWidth = width
            target!.innerHTML = ""
            google.accounts.id.renderButton(target!, {
                theme: "outline",
                size: "large",
                shape: "rectangular",
                text,
                logo_alignment: "left",
                width
            })
        }

        draw()
        const observer = new ResizeObserver(draw)
        observer.observe(wrap)
        return () => observer.disconnect()
    }, [isReady, text])

    if (!clientId || hasFailed) {
        return null
    }

    return (
        <div className="google-section">
            <p className="auth-divider"><span>or</span></p>
            <div ref={wrapRef} className={`google-button-wrap${disabled ? " is-disabled" : ""}`} aria-busy={disabled ? true : undefined}>
                <div ref={buttonRef} />
            </div>
        </div>
    )
}

export default GoogleSignInButton
