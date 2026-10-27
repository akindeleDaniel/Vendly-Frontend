import { useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, ImagePlus, Trash2 } from "lucide-react"
import { ACCEPTED_IMAGE_TYPES, MIN_PRODUCT_PHOTO_SIZE, checkProductPhotoSize, validateImageFile } from "../lib/imageFile"
import { MAX_LISTING_PHOTOS, type ListingPhoto } from "../lib/listingPhotos"
import ImageCropDialog from "./ImageCropDialog"
import Notice from "./Notice"

type ListingPhotosPickerProps = {
    photos: ListingPhoto[]
    onChange: (photos: ListingPhoto[]) => void
    disabled?: boolean
}

const TIPS = [
    "The first photo is your cover",
    "Each is cropped to a square",
    `At least ${MIN_PRODUCT_PHOTO_SIZE} × ${MIN_PRODUCT_PHOTO_SIZE} pixels, so it looks sharp`,
    "JPG, PNG, WebP or GIF, up to 10 MB"
]

// A product's photos in five square slots: add up to five (each cropped to a square and checked for
// size), remove one, or move one earlier or later. The first photo is the cover shoppers see first.
function ListingPhotosPicker({ photos, onChange, disabled }: ListingPhotosPickerProps) {
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

    async function handleChoose(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const file = input.files?.[0] ?? null
        input.value = ""// lets the same file be chosen again later
        setError("")

        if (!file) {
            return
        }

        const problem = validateImageFile(file) ?? await checkProductPhotoSize(file, false)
        if (problem) {
            setError(problem)
            return
        }

        setPendingFile(file)// opens the crop screen
    }

    async function handleCropDone(croppedFile: File) {
        setPendingFile(null)
        const problem = await checkProductPhotoSize(croppedFile, true)
        if (problem) {
            setError(problem)
            return
        }
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

    const emptySlots = Math.max(0, MAX_LISTING_PHOTOS - photos.length - 1)

    return (
        <div className="photo-slots-picker">
            <ul className="photo-slots" aria-label={`Photos, ${photos.length} of ${MAX_LISTING_PHOTOS}`}>
                {photos.map((photo, index) => (
                    <li key={photo.id} className={`photo-slot${index === 0 ? " is-cover" : ""}`}>
                        <img src={photo.url} alt={`Photo ${index + 1}${index === 0 ? ", the cover" : ""}`} />
                        {index === 0 && <span className="photo-slot-cover">Cover</span>}
                        <div className="photo-slot-tools">
                            <span>
                                <button type="button" onClick={() => handleMove(index, -1)} disabled={disabled || index === 0} aria-label={`Move photo ${index + 1} earlier`}>
                                    <ChevronLeft size={16} aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => handleMove(index, 1)} disabled={disabled || index === photos.length - 1} aria-label={`Move photo ${index + 1} later`}>
                                    <ChevronRight size={16} aria-hidden="true" />
                                </button>
                            </span>
                            <button type="button" onClick={() => handleRemove(index)} disabled={disabled} aria-label={`Remove photo ${index + 1}`}>
                                <Trash2 size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </li>
                ))}
                {photos.length < MAX_LISTING_PHOTOS && (
                    <li>
                        <button type="button" className="photo-slot-add" onClick={() => inputRef.current?.click()} disabled={disabled}>
                            <ImagePlus size={24} aria-hidden="true" />
                            {photos.length === 0 ? "Add a photo" : "Add another"}
                        </button>
                    </li>
                )}
                {Array.from({ length: emptySlots }, (_, index) => <li key={`empty-${index}`} className="photo-slot-empty" aria-hidden="true" />)}
            </ul>
            <input ref={inputRef} type="file" hidden accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={handleChoose} />
            <ul className="photo-tips">
                {TIPS.map((tip) => <li key={tip}><Check size={14} strokeWidth={3} aria-hidden="true" />{tip}</li>)}
            </ul>
            {error && <Notice kind="error">{error}</Notice>}
            {pendingFile && (
                <ImageCropDialog file={pendingFile} onCancel={() => setPendingFile(null)} onDone={handleCropDone} />
            )}
        </div>
    )
}

export default ListingPhotosPicker
