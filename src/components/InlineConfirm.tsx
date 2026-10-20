import { useState } from "react"
import Notice from "./Notice"

type InlineConfirmProps = {
    buttonLabel: string
    prompt: string
    confirmLabel: string
    // Does the action. Returns an error to show, or null when it worked.
    onConfirm: () => Promise<string | null>
    danger?: boolean
}

// A button that asks "are you sure?" on the page itself before doing something that cannot be
// undone, instead of a browser pop-up.
function InlineConfirm({ buttonLabel, prompt, confirmLabel, onConfirm, danger }: InlineConfirmProps) {
    const [isAsking, setIsAsking] = useState(false)
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")

    async function confirm() {
        setIsWorking(true)
        setError("")
        const failure = await onConfirm()
        setIsWorking(false)

        if (failure) {
            setError(failure)
        } else {
            setIsAsking(false)
        }
    }

    if (!isAsking) {
        return <button type="button" onClick={() => setIsAsking(true)}>{buttonLabel}</button>
    }

    return (
        <div className="inline-confirm">
            <Notice kind="warning">
                <p>{prompt}</p>
                {error && <p>{error}</p>}
                <div className="action-row">
                    <button type="button" className={danger ? "btn btn-danger" : "btn btn-primary"} disabled={isWorking} onClick={confirm}>
                        {isWorking ? "Please wait..." : confirmLabel}
                    </button>
                    <button type="button" disabled={isWorking} onClick={() => { setIsAsking(false); setError("") }}>Cancel</button>
                </div>
            </Notice>
        </div>
    )
}

export default InlineConfirm
