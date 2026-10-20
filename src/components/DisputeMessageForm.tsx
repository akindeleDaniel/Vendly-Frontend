import { useId, useState } from "react"
import EvidenceUploader from "./EvidenceUploader"
import Notice from "./Notice"
import { MESSAGE_MAX_LENGTH, validateMessage } from "../lib/disputeMessage"

type DisputeMessageFormProps = {
    label: string
    submitLabel: string
    // Sends the message. Returns an error to show, or null when it worked.
    onSend: (message: string, evidenceUrls: string[]) => Promise<string | null>
}

// A message box with photos, used to write in a complaint's conversation.
function DisputeMessageForm({ label, submitLabel, onSend }: DisputeMessageFormProps) {
    const textId = useId()
    const [message, setMessage] = useState("")
    const [urls, setUrls] = useState<string[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSending || isUploading) {
            return
        }

        const problem = validateMessage(message)
        if (problem) {
            setError(problem)
            return
        }

        setIsSending(true)
        setError("")
        const failure = await onSend(message.trim(), urls)
        setIsSending(false)

        if (failure) {
            setError(failure)
            return
        }

        setMessage("")
        setUrls([])
    }

    return (
        <form onSubmit={handleSubmit} className="dispute-form">
            <label htmlFor={textId}>{label}</label>
            <textarea
                id={textId}
                value={message}
                maxLength={MESSAGE_MAX_LENGTH}
                disabled={isSending}
                onChange={(event) => setMessage(event.target.value)}
            />
            <EvidenceUploader urls={urls} onChange={setUrls} onUploadingChange={setIsUploading} disabled={isSending} />
            {error && <Notice kind="error">{error}</Notice>}
            <button type="submit" disabled={isSending || isUploading || message.trim() === ""}>
                {isSending ? "Sending..." : submitLabel}
            </button>
        </form>
    )
}

export default DisputeMessageForm
