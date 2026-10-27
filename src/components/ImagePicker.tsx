import { useEffect, useId, useRef, useState } from "react"
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "../lib/imageFile"
import ImageCropDialog from "./ImageCropDialog"
import Notice from "./Notice"

type ImagePickerProps = {
    label: string
    onChange: (file: File | null) => void
    currentUrl?: string // an image that already exists; shown until a new one is chosen
    disabled?: boolean
    aspect?: number // width divided by height of the crop; 1 (square) unless given
}

// Choose an image, crop it to a square, and see the result. A file that is the wrong type or too
// large is rejected with a clear message. Only the cropped copy is passed on, so what the seller
// sees in the preview is exactly what gets uploaded and shown to shoppers.
function ImagePicker({ label, onChange, currentUrl, disabled, aspect = 1 }: ImagePickerProps) {
    const labelId = useId()
    const helpId = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [pendingFile, setPendingFile] = useState<File | null>(null)// chosen, waiting to be cropped
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
        input.value = ""// lets the same file be chosen again later
        setError("")

        if (!file) {
            return
        }

        const problem = validateImageFile(file)
        if (problem) {
            setError(problem)
            return
        }

        setPendingFile(file)// opens the crop screen
    }

    function handleCropDone(croppedFile: File) {
        setPendingFile(null)
        setPreviewUrl(URL.createObjectURL(croppedFile))
        onChange(croppedFile)
    }

    function handleRemove() {
        setPreviewUrl(null)
        setError("")
        onChange(null)
    }

    const shownUrl = previewUrl ?? currentUrl ?? null

    return (
        <div className="image-picker">
            <p id={labelId} className="image-picker-label">{label}</p>
            <div className="image-picker-body">
                {shownUrl
                    ? <img className={aspect === 1 ? "image-preview" : "image-preview image-preview-wide"} src={shownUrl} alt={previewUrl ? "Preview of the cropped image" : "Current image"} />
                    : <span className={aspect === 1 ? "image-preview image-preview-empty" : "image-preview image-preview-wide image-preview-empty"} aria-hidden="true">No image</span>}
                <div className="image-picker-actions">
                    <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled} aria-describedby={helpId}>
                        {shownUrl ? "Change image" : "Choose image"}
                        <span className="visually-hidden"> for {label}</span>
                    </button>
                    {previewUrl && (
                        <button type="button" className="btn-text" onClick={handleRemove} disabled={disabled}>Remove</button>
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    hidden
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    onChange={handleChange}
                />
            </div>
            <p id={helpId} className="image-picker-help">JPG, PNG, WebP or GIF, up to 10 MB. You can crop it to {aspect === 1 ? "a square" : "a wide banner"} next.</p>
            {error && <Notice kind="error">{error}</Notice>}
            {pendingFile && (
                <ImageCropDialog
                    file={pendingFile}
                    aspect={aspect}
                    onCancel={() => setPendingFile(null)}
                    onDone={handleCropDone}
                />
            )}
        </div>
    )
}

export default ImagePicker
