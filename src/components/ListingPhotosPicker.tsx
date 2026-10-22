import { useEffect, useId, useRef, useState } from "react"
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "../lib/imageFile"
import { MAX_LISTING_PHOTOS, type ListingPhoto } from "../lib/listingPhotos"
import ImageCropDialog from "./ImageCropDialog"
import Notice from "./Notice"

type ListingPhotosPickerProps = {
    photos: ListingPhoto[]
    onChange: (photos: ListingPhoto[]) => void
    disabled?: boolean
}

// A listing's photos: add up to five (each cropped to a square), remove one, or move one earlier or
// later. The first photo is the one shown on the listing's card.
function ListingPhotosPicker({ photos, onChange, disabled }: ListingPhotosPickerProps) {
    const helpId = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    const [pendingFile, setPendingFile] = useState<File | null>(null)// chosen, waiting to be cropped
    const [error, setError] = useState("")
    const latestPhotos = useRef(photos)

    useEffect(() => {
        latestPhotos.current = photos
    }, [photos])

    // Frees the temporary preview addresses when the picker goes away.
    useEffect(() => {
        return () => {
            for (const photo of latestPhotos.current) {
                if (photo.file !== null) {
                    URL.revokeObjectURL(photo.url)
                }
            }
        }
    }, [])

    function handleChoose(event: React.ChangeEvent<HTMLInputElement>) {
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
        onChange([...photos, { id: `new-${Date.now()}-${photos.length}`, url: URL.createObjectURL(croppedFile), file: croppedFile }])
    }

    function handleRemove(index: number) {
        const removed = photos[index]
        if (removed.file !== null) {
            URL.revokeObjectURL(removed.url)
        }
        onChange(photos.filter((_, position) => position !== index))
    }

    function handleMove(index: number, direction: -1 | 1) {
        const target = index + direction
        if (target < 0 || target >= photos.length) {
            return
        }

        const next = [...photos]
        ;[next[index], next[target]] = [next[target], next[index]]
        onChange(next)
    }

    return (
        <div className="image-picker">
            <p className="image-picker-label">Photos ({photos.length} of {MAX_LISTING_PHOTOS})</p>
            {photos.length > 0 && (
                <ul className="photo-list">
                    {photos.map((photo, index) => (
                        <li key={photo.id} className="photo-item">
                            <img className="image-preview" src={photo.url} alt={`Photo ${index + 1}`} />
                            {index === 0 && <span className="badge photo-main-badge">Main</span>}
                            <div className="photo-item-actions">
                                <button type="button" className="btn-text" onClick={() => handleMove(index, -1)} disabled={disabled || index === 0}>
                                    Earlier<span className="visually-hidden"> (move photo {index + 1})</span>
                                </button>
                                <button type="button" className="btn-text" onClick={() => handleMove(index, 1)} disabled={disabled || index === photos.length - 1}>
                                    Later<span className="visually-hidden"> (move photo {index + 1})</span>
                                </button>
                                <button type="button" className="btn-text" onClick={() => handleRemove(index)} disabled={disabled}>
                                    Remove<span className="visually-hidden"> photo {index + 1}</span>
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || photos.length >= MAX_LISTING_PHOTOS}
                aria-describedby={helpId}
            >
                {photos.length === 0 ? "Choose a photo" : "Add another photo"}
            </button>
            <input ref={inputRef} type="file" hidden accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={handleChoose} />
            <p id={helpId} className="image-picker-help">
                Up to {MAX_LISTING_PHOTOS} photos. The first one is shown on the listing's card. JPG, PNG, WebP or GIF, up to 10 MB. You can crop each to a square.
            </p>
            {error && <Notice kind="error">{error}</Notice>}
            {pendingFile && (
                <ImageCropDialog file={pendingFile} onCancel={() => setPendingFile(null)} onDone={handleCropDone} />
            )}
        </div>
    )
}

export default ListingPhotosPicker
