import { useId, useState } from "react"
import type { ReactNode } from "react"
import { Check, Eye, EyeOff, Info } from "lucide-react"

type PasswordFieldProps = {
    label: string
    name: string
    value: string
    onChange: (value: string) => void
    autoComplete: "current-password" | "new-password"
    disabled?: boolean
    labelAside?: ReactNode// beside the label, such as "Forgot password?"
    // For a new password: a line under the field that turns green once it is long enough.
    minLength?: number
    note?: string// a second line under the field
}

// A password box with a button that shows or hides what was typed.
function PasswordField({ label, name, value, onChange, autoComplete, disabled, labelAside, minLength, note }: PasswordFieldProps) {
    const inputId = useId()
    const hintId = useId()
    const [isShown, setIsShown] = useState(false)
    const isLongEnough = minLength !== undefined && value.length >= minLength

    return (
        <div className="auth-field">
            <div className="auth-field-top">
                <label htmlFor={inputId}>{label}</label>
                {labelAside}
            </div>
            <div className="auth-input">
                <input
                    id={inputId}
                    name={name}
                    type={isShown ? "text" : "password"}
                    autoComplete={autoComplete}
                    value={value}
                    disabled={disabled}
                    aria-describedby={minLength !== undefined || note ? hintId : undefined}
                    onChange={(event) => onChange(event.target.value)}
                />
                <button
                    type="button"
                    className="auth-eye"
                    aria-label={isShown ? "Hide password" : "Show password"}
                    aria-pressed={isShown}
                    onClick={() => setIsShown((shown) => !shown)}
                >
                    {isShown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
            </div>
            {(minLength !== undefined || note) && (
                <div id={hintId}>
                    {minLength !== undefined && (
                        <p className={`auth-check${isLongEnough ? " is-ok" : ""}`}>
                            {isLongEnough ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
                            {isLongEnough ? "Long enough. Avoid common passwords." : `At least ${minLength} characters. Avoid common passwords.`}
                        </p>
                    )}
                    {note && <p className="auth-check">{note}</p>}
                </div>
            )}
        </div>
    )
}

export default PasswordField
