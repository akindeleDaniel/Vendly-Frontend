import { useEffect, useId, useState } from "react"
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "../lib/imageFile"
import Notice from "./Notice"

type ImagePickerProps = {
    label: string
    onChange: (file: File | null) => void
    currentUrl?: string // an image that already exists; shown until a new one is chosen
    disabled?: boolean
}

// A file field with a preview. A file that is the wrong type or too large is rejected with a clear
// message and is never passed on, so the form can only ever hold an image that is safe to upload.
function ImagePicker({ label, onChange, currentUrl, disabled }: ImagePickerProps) {
    const inputId = useId()
    const helpId = useId()
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [error, setError] = useState("")

    // Frees the temporary preview address when it is replaced or the field goes away.
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl)
            }
        }
    }, [previewUrl])

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const file = input.files?.[0] ?? null
        setError("")

        if (!file) {
            setPreviewUrl(null)
            onChange(null)
            return
        }

        const problem = validateImageFile(file)
        if (problem) {
            setError(problem)
            setPreviewUrl(null)
            onChange(null)
            input.value = ""// lets the same file be chosen again after fixing it
            return
        }

        setPreviewUrl(URL.createObjectURL(file))
        onChange(file)
    }

    const shownUrl = previewUrl ?? currentUrl ?? null

    return (
        <div className="image-picker">
            <label htmlFor={inputId} className="image-picker-label">{label}</label>
            <div className="image-picker-body">
                {shownUrl
                    ? <img className="image-preview" src={shownUrl} alt={previewUrl ? "Preview of the chosen image" : "Current image"} />
                    : <span className="image-preview image-preview-empty" aria-hidden="true">No image</span>}
                <input
                    id={inputId}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    disabled={disabled}
                    aria-describedby={helpId}
                    onChange={handleChange}
                />
            </div>
            <p id={helpId} className="image-picker-help">JPG, PNG, WebP or GIF, up to 10 MB.</p>
            {error && <Notice kind="error">{error}</Notice>}
        </div>
    )
}

export default ImagePicker
