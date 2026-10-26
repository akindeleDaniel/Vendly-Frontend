import { useId, useState } from "react"
import EvidenceUploader from "./EvidenceUploader"
import Notice from "./Notice"
import { respondToDispute } from "../lib/disputeApi"
import { MESSAGE_MAX_LENGTH, validateMessage } from "../lib/disputeMessage"
import { failureMessage } from "../lib/apiRequest"
import type { Dispute } from "../types/dispute"

type Choice = "AGREE_TO_REFUND" | "DISAGREE"

// The seller's answer to a complaint: agree to the refund, or disagree and say why. Agreeing sends
// the complaint to StoreHatch, which issues the refund; disagreeing sends it to StoreHatch to decide.
function SellerRespondPanel({ dispute, onUpdated }: { dispute: Dispute, onUpdated: (dispute: Dispute) => void }) {
    const choiceName = useId()
    const messageId = useId()
    const [choice, setChoice] = useState<Choice | null>(null)
    const [message, setMessage] = useState("")
    const [urls, setUrls] = useState<string[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (choice === null || isSending || isUploading) {
            return
        }

        const problem = validateMessage(message, "response")
        if (problem) {
            setError(problem)
            return
        }

        setIsSending(true)
        setError("")
        const result = await respondToDispute(dispute.id, choice, message.trim(), urls)
        setIsSending(false)

        if (result.kind === "ok") {
            onUpdated(result.data.dispute)
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <section aria-labelledby="respond-heading" className="card summary-card">
            <h2 id="respond-heading">Your response</h2>
            <p className="field-help">
                The buyer is waiting for you. {dispute.responseDueAt ? "If you do not respond in time, StoreHatch will decide this complaint. " : ""}
                Agreeing means you accept the refund; StoreHatch then issues it.
            </p>
            <form onSubmit={handleSubmit} className="dispute-form">
                <fieldset className="choice-fieldset">
                    <legend>What would you like to do?</legend>
                    <label className="checkbox-label">
                        <input type="radio" name={choiceName} checked={choice === "AGREE_TO_REFUND"} disabled={isSending} onChange={() => setChoice("AGREE_TO_REFUND")} />
                        I agree to refund the buyer
                    </label>
                    <label className="checkbox-label">
                        <input type="radio" name={choiceName} checked={choice === "DISAGREE"} disabled={isSending} onChange={() => setChoice("DISAGREE")} />
                        I disagree with this complaint
                    </label>
                </fieldset>
                <label htmlFor={messageId}>Message to the buyer and StoreHatch</label>
                <textarea id={messageId} value={message} maxLength={MESSAGE_MAX_LENGTH} disabled={isSending} onChange={(event) => setMessage(event.target.value)} />
                <EvidenceUploader urls={urls} onChange={setUrls} onUploadingChange={setIsUploading} disabled={isSending} />
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" disabled={choice === null || message.trim() === "" || isSending || isUploading}>
                    {isSending ? "Sending..." : "Send response"}
                </button>
            </form>
        </section>
    )
}

export default SellerRespondPanel
