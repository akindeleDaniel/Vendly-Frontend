import { useId, useRef, useState } from "react"
import { Camera, Plus, RotateCcw, X } from "lucide-react"
import { REVIEW_PHOTO_LIMIT } from "../lib/useReviewPhotos"
import type { ReviewPhotos } from "../lib/useReviewPhotos"

type ReviewPhotoFieldProps = {
    target: string
    about: string // for example "the shop" or "the Ankara dress", for screen readers
    photos: ReviewPhotos
    disabled?: boolean
}

// Up to 3 optional photos of what arrived, as small tiles with a remove button. Each one uploads as
// soon as it is picked; one that fails can be tried again.
function ReviewPhotoField({ target, about, photos, disabled = false }: ReviewPhotoFieldProps) {
    const inputId = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    const [note, setNote] = useState("")
    const list = photos.photos[target] ?? []
    const left = REVIEW_PHOTO_LIMIT - list.length

    async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ""// so the same photo can be picked again after removing it

        if (files.length === 0) {
            return
        }

        const leftOut = await photos.add(target, files)
        setNote(leftOut > 0 ? `Only ${REVIEW_PHOTO_LIMIT} photos fit, so ${leftOut === 1 ? "1 was" : `${leftOut} were`} left out.` : "")
    }

    const picker = (
        <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="visually-hidden"
            aria-label={`Choose photos of ${about}`}
            tabIndex={-1}
            disabled={disabled}
            onChange={handleFiles}
        />
    )

    if (list.length === 0) {
        return (
            <div className="review-photo-field">
                {picker}
                <button type="button" className="review-photo-first" disabled={disabled} onClick={() => inputRef.current?.click()}>
                    <Camera size={18} aria-hidden="true" />Add photos <span>(optional)</span>
                </button>
            </div>
        )
    }

    return (
        <div className="review-photo-field" role="group" aria-label={`Photos of ${about}`}>
            {picker}
            <p className="review-photo-label">Photos <span>Optional. Up to {REVIEW_PHOTO_LIMIT} of what arrived; shoppers see them with your review.</span></p>
            <ul className="review-photo-tiles">
                {list.map((photo, index) => (
                    <li key={photo.key} className={`review-photo-tile is-${photo.status}`}>
                        <img src={photo.preview} alt={`Your photo ${index + 1}`} />
                        {photo.status === "uploading" && (
                            <>
                                <span className="review-photo-bar" aria-hidden="true"><i /></span>
                                <span className="review-photo-state" role="status">Uploading…</span>
                            </>
                        )}
                        {photo.status === "failed" && (
                            <>
                                <button type="button" className="review-photo-retry" disabled={disabled} onClick={() => photos.retry(target, photo.key)}>
                                    <RotateCcw size={18} aria-hidden="true" />Try again
                                </button>
                                <span className="review-photo-state">{photo.reason === "offline" ? "You're offline" : "Didn't upload"}</span>
                            </>
                        )}
                        <button
                            type="button"
                            className="review-photo-remove"
                            aria-label={`Remove photo ${index + 1}`}
                            disabled={disabled}
                            onClick={() => photos.remove(target, photo.key)}
                        >
                            <X size={14} strokeWidth={2.8} aria-hidden="true" />
                        </button>
                    </li>
                ))}
                {left > 0 && (
                    <li>
                        <button type="button" className="review-photo-add" disabled={disabled} onClick={() => inputRef.current?.click()}>
                            <Plus size={22} aria-hidden="true" />Add photo<small>{left} more</small>
                        </button>
                    </li>
                )}
            </ul>
            {note && <p className="review-photo-note" role="status">{note}</p>}
        </div>
    )
}

export default ReviewPhotoField
