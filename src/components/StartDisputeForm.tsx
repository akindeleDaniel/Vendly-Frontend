import { useId, useState } from "react"
import EvidenceUploader from "./EvidenceUploader"
import Notice from "./Notice"
import { parseOptionalNaira } from "../lib/amountInput"
import { MESSAGE_MAX_LENGTH, validateMessage } from "../lib/disputeMessage"
import { DISPUTE_REASON_OPTIONS } from "../types/dispute"

export type StartDisputeInput = {
    reason: string
    message: string
    amount: string | undefined
    evidenceUrls: string[]
}

type StartDisputeFormProps = {
    // A buyer chooses a reason; a seller offering a refund does not.
    showReason: boolean
    messageLabel: string
    amountLabel: string
    submitLabel: string
    // Sends the form. Returns an error to show, or null when it worked (the page then moves on).
    onSubmit: (input: StartDisputeInput) => Promise<string | null>
}

// The form for opening a complaint (buyer) or offering a refund (seller): a reason, a message,
// an optional amount and optional photos. The backend checks the amount against the order.
function StartDisputeForm({ showReason, messageLabel, amountLabel, submitLabel, onSubmit }: StartDisputeFormProps) {
    const reasonId = useId()
    const messageId = useId()
    const amountId = useId()
    const [reason, setReason] = useState("")
    const [message, setMessage] = useState("")
    const [amount, setAmount] = useState("")
    const [urls, setUrls] = useState<string[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSending || isUploading) {
            return
        }

        if (showReason && reason === "") {
            setError("Choose what went wrong.")
            return
        }

        const problem = validateMessage(message)
        if (problem) {
            setError(problem)
            return
        }

        const parsedAmount = parseOptionalNaira(amount)
        if (!parsedAmount.ok) {
            setError(parsedAmount.message)
            return
        }

        setIsSending(true)
        setError("")
        const failure = await onSubmit({ reason, message: message.trim(), amount: parsedAmount.value, evidenceUrls: urls })
        setIsSending(false)

        if (failure) {
            setError(failure)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="dispute-form">
            {showReason && (
                <>
                    <label htmlFor={reasonId}>What went wrong?</label>
                    <select id={reasonId} value={reason} disabled={isSending} onChange={(event) => setReason(event.target.value)}>
                        <option value="">Choose a reason</option>
                        {DISPUTE_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </>
            )}

            <label htmlFor={messageId}>{messageLabel}</label>
            <textarea id={messageId} value={message} maxLength={MESSAGE_MAX_LENGTH} disabled={isSending} onChange={(event) => setMessage(event.target.value)} />

            <label htmlFor={amountId}>{amountLabel}</label>
            <input id={amountId} inputMode="decimal" placeholder="Leave empty for the full order" value={amount} disabled={isSending} onChange={(event) => setAmount(event.target.value)} />

            <EvidenceUploader urls={urls} onChange={setUrls} onUploadingChange={setIsUploading} disabled={isSending} />

            {error && <Notice kind="error">{error}</Notice>}
            <button type="submit" className="btn-block btn-lg" disabled={isSending || isUploading}>
                {isSending ? "Sending..." : submitLabel}
            </button>
        </form>
    )
}

export default StartDisputeForm
