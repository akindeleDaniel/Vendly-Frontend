import { useId, useRef, useState } from "react"
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "../lib/imageFile"
import { uploadImage } from "../lib/uploadImage"
import Notice from "./Notice"

export const MAX_EVIDENCE_PHOTOS = 5

type EvidenceUploaderProps = {
    urls: string[]
    onChange: (urls: string[]) => void
    onUploadingChange?: (isUploading: boolean) => void
    disabled?: boolean
}

// Photos a person attaches to a complaint message. Each photo is uploaded as soon as it is chosen,
// and the form only holds the links, which is what the backend takes (up to five).
function EvidenceUploader({ urls, onChange, onUploadingChange, disabled }: EvidenceUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const helpId = useId()
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState("")

    function setUploading(value: boolean) {
        setIsUploading(value)
        onUploadingChange?.(value)
    }

    async function handleChosen(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const files = Array.from(input.files ?? [])
        input.value = ""// lets the same photo be chosen again

        if (files.length === 0) {
            return
        }

        const room = MAX_EVIDENCE_PHOTOS - urls.length
        const problems: string[] = []
        const accepted: File[] = []

        for (const file of files.slice(0, room)) {
            const problem = validateImageFile(file)
            if (problem) {
                problems.push(`${file.name}: ${problem}`)
            } else {
                accepted.push(file)
            }
        }

        if (files.length > room) {
            problems.push(`You can attach up to ${MAX_EVIDENCE_PHOTOS} photos.`)
        }

        setError(problems.join(" "))

        if (accepted.length === 0) {
            return
        }

        setUploading(true)
        const uploaded: string[] = []
        let failed = 0

        for (const file of accepted) {
            const url = await uploadImage(file)
            if (url) {
                uploaded.push(url)
            } else {
                failed += 1
            }
        }

        setUploading(false)

        if (uploaded.length > 0) {
            onChange([...urls, ...uploaded])
        }

        if (failed > 0) {
            setError((current) => `${current} ${failed === 1 ? "One photo" : `${failed} photos`} could not be uploaded. Please try again.`.trim())
        }
    }

    return (
        <div className="evidence-uploader">
            <span className="evidence-label">Photos (optional)</span>
            {urls.length > 0 && (
                <ul className="evidence-list">
                    {urls.map((url, index) => (
                        <li key={url}>
                            <img src={url} alt={`Attached photo ${index + 1}`} />
                            <button
                                type="button"
                                className="btn-text"
                                disabled={disabled || isUploading}
                                onClick={() => onChange(urls.filter((candidate) => candidate !== url))}
                                aria-label={`Remove photo ${index + 1}`}
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                onChange={handleChosen}
                tabIndex={-1}
            />
            <div className="image-picker-actions">
                <button
                    type="button"
                    aria-describedby={helpId}
                    disabled={disabled || isUploading || urls.length >= MAX_EVIDENCE_PHOTOS}
                    onClick={() => inputRef.current?.click()}
                >
                    {isUploading ? "Uploading..." : urls.length > 0 ? "Add more photos" : "Add photos"}
                </button>
            </div>
            <p id={helpId} className="image-picker-help">Up to {MAX_EVIDENCE_PHOTOS} photos. JPG, PNG, WebP or GIF, up to 10 MB each.</p>
            {error && <Notice kind="error">{error}</Notice>}
        </div>
    )
}

export default EvidenceUploader
