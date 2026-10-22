import { useState } from "react"
import Notice from "./Notice"
import { failureMessage } from "../lib/apiRequest"
import { reopenDispute } from "../lib/disputeApi"
import { MESSAGE_MAX_LENGTH, validateMessage } from "../lib/disputeMessage"
import type { Dispute } from "../types/dispute"

// An administrator puts a rejected complaint back in the queue. Both sides read the note. The buyer's
// own appeal is still available afterwards.
function ReopenDisputePanel({ dispute, onUpdated }: { dispute: Dispute, onUpdated: (dispute: Dispute) => void }) {
    const [note, setNote] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSending) {
            return
        }

        const problem = validateMessage(note, "note")
        if (problem) {
            setError(problem)
            return
        }

        setIsSending(true)
        setError("")
        const result = await reopenDispute(dispute.id, note.trim())
        setIsSending(false)

        if (result.kind === "ok") {
            onUpdated(result.data.dispute)
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <details className="card summary-card admin-issue">
            <summary>Reopen this complaint</summary>
            <p className="field-help">It goes back to the queue to be decided again. Both sides read your note. The buyer can still appeal once afterwards.</p>
            <form onSubmit={handleSubmit} className="dispute-form">
                <label>
                    Note for both sides
                    <textarea value={note} maxLength={MESSAGE_MAX_LENGTH} disabled={isSending} onChange={(event) => setNote(event.target.value)} />
                </label>
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" disabled={isSending}>{isSending ? "Reopening..." : "Reopen the complaint"}</button>
            </form>
        </details>
    )
}

export default ReopenDisputePanel
