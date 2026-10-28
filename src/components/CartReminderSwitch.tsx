import { useEffect, useId, useState } from "react"
import { apiRequest, failureMessage, isRecord } from "../lib/apiRequest"

type Preferences = { cartReminders: boolean }

function isPreferences(value: unknown): value is Preferences {
    return isRecord(value) && typeof value.cartReminders === "boolean"
}

// Whether StoreHatch may email once about a cart left for a day. The current setting comes from the
// session check; a change is saved straight away. The email's own stop link turns it off too.
function CartReminderSwitch() {
    const id = useId()
    const [isOn, setIsOn] = useState<boolean | null>(null)// null until the setting has loaded
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        const controller = new AbortController()

        apiRequest<Preferences>("/users/check", { signal: controller.signal, isValid: isPreferences }).then((result) => {
            if (!controller.signal.aborted && result.kind === "ok") {
                setIsOn(result.data.cartReminders)
            }
        })

        return () => controller.abort()
    }, [])

    async function change(next: boolean) {
        setIsSaving(true)
        setError("")
        const result = await apiRequest<Preferences>("/users/preferences", { method: "PATCH", body: { cartReminders: next }, isValid: isPreferences })
        setIsSaving(false)

        if (result.kind === "ok") {
            setIsOn(result.data.cartReminders)
        } else if (result.kind !== "unauthorized") {
            setError(failureMessage(result))
        }
    }

    if (isOn === null) {
        return null// an older backend, or the check failed: the choice simply isn't offered
    }

    return (
        <div className="logout-option logout-option-separated">
            <label className="cart-reminder-switch" htmlFor={id}>
                <input id={id} type="checkbox" role="switch" checked={isOn} disabled={isSaving} onChange={(event) => change(event.target.checked)} />
                <span>
                    <b>Cart reminder emails</b>
                    <span className="field-help">If you leave something in your cart for a day, we email you once.</span>
                </span>
            </label>
            {error && <p role="alert" className="alert alert-error">{error}</p>}
        </div>
    )
}

export default CartReminderSwitch
