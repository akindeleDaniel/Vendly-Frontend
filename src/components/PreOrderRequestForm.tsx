import { useState } from "react"
import { Link } from "react-router-dom"
import Notice from "./Notice"
import { failureMessage } from "../lib/apiRequest"
import { askForPreOrder } from "../lib/preOrderApi"
import {
    PRE_ORDER_MAX_DAYS_AHEAD,
    PRE_ORDER_MIN_HOURS_AHEAD,
    PRE_ORDER_NOTE_MAX_LENGTH
} from "../types/preOrder"

// The value a datetime-local box wants ("2026-11-02T14:00"), in the shopper's own time zone.
function toLocalInputValue(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
}

type PreOrderRequestFormProps = {
    sellerSlug: string
    businessName: string
    // True when the shop also sells for delivery now, so asking is optional.
    optional: boolean
}

// Asks a food shop to prepare what is in the cart for a chosen time. Nothing is charged: the shop has
// 48 hours to answer, and after it approves the shopper pays at checkout.
function PreOrderRequestForm({ sellerSlug, businessName, optional }: PreOrderRequestFormProps) {
    const [isOpen, setIsOpen] = useState(!optional)
    const [readyAt, setReadyAt] = useState("")
    const [note, setNote] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")
    const [existingId, setExistingId] = useState<number | null>(null)
    const [sentId, setSentId] = useState<number | null>(null)

    const now = new Date()
    const earliest = toLocalInputValue(new Date(now.getTime() + PRE_ORDER_MIN_HOURS_AHEAD * 3600000))
    const latest = toLocalInputValue(new Date(now.getTime() + PRE_ORDER_MAX_DAYS_AHEAD * 86400000))

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSending) {
            return
        }

        const chosen = new Date(readyAt)
        if (readyAt === "" || Number.isNaN(chosen.getTime())) {
            setError("Choose the date and time you want it ready.")
            return
        }

        setIsSending(true)
        setError("")
        setExistingId(null)
        const result = await askForPreOrder(sellerSlug, chosen.toISOString(), note.trim())
        setIsSending(false)

        if (result.kind === "ok") {
            setSentId(result.data.preOrder.id)
        } else {
            setError(failureMessage(result))
            if (result.kind === "failed" && result.code === "PREORDER_EXISTS" && typeof (result.body as { preOrderId?: unknown })?.preOrderId === "number") {
                setExistingId((result.body as { preOrderId: number }).preOrderId)
            }
        }
    }

    if (sentId !== null) {
        return (
            <Notice kind="success">
                <p>Your request has been sent to {businessName}. Nothing has been charged. They have 48 hours to answer, and we will email you.</p>
                <p>When it is approved, come back to this page to pay. Do not change your cart before then, or the approval will not match.</p>
                <Link to={`/pre-orders/${sentId}`}>View your request</Link>
            </Notice>
        )
    }

    if (!isOpen) {
        return <button type="button" onClick={() => setIsOpen(true)}>Ask {businessName} for a pre-order instead</button>
    }

    return (
        <form onSubmit={handleSubmit} className="stack-form preorder-form">
            <h4>Ask for a pre-order</h4>
            <p className="field-help">
                Choose when you want it ready, at least {PRE_ORDER_MIN_HOURS_AHEAD} hours from now and within {PRE_ORDER_MAX_DAYS_AHEAD} days.
                The shop can approve or decline. Nothing is charged until you pay after it approves.
            </p>
            <label>
                Ready on
                <input type="datetime-local" min={earliest} max={latest} value={readyAt} disabled={isSending} onChange={(event) => setReadyAt(event.target.value)} />
            </label>
            <label>
                Note for the shop (optional)
                <textarea maxLength={PRE_ORDER_NOTE_MAX_LENGTH} value={note} disabled={isSending} onChange={(event) => setNote(event.target.value)} />
            </label>
            {error && (
                <Notice kind="error">
                    <p>{error}</p>
                    {existingId !== null && <Link to={`/pre-orders/${existingId}`}>View the request you already have</Link>}
                </Notice>
            )}
            <div className="action-row">
                <button type="submit" className="btn btn-primary" disabled={isSending}>{isSending ? "Sending..." : "Send request"}</button>
                {optional && <button type="button" onClick={() => setIsOpen(false)} disabled={isSending}>Cancel</button>}
            </div>
        </form>
    )
}

export default PreOrderRequestForm
