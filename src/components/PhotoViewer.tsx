import { useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

type PhotoViewerProps = {
    photos: string[]
    index: number | null // null: closed
    caption: string
    onIndex: (index: number) => void
    onClose: () => void
}

// Shows a review's photos one at a time, large, with Previous and Next and small pictures to jump
// between them. A real modal dialog: the keyboard stays inside it, Escape closes it and the arrow keys
// move between photos.
function PhotoViewer({ photos, index, caption, onIndex, onClose }: PhotoViewerProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const isOpen = index !== null && photos.length > 0

    useEffect(() => {
        const dialog = dialogRef.current

        if (!dialog) {
            return
        }

        if (isOpen && !dialog.open) {
            dialog.showModal()
        } else if (!isOpen && dialog.open) {
            dialog.close()
        }
    }, [isOpen])

    const current = index ?? 0
    const atStart = current <= 0
    const atEnd = current >= photos.length - 1

    function handleKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
        if (event.key === "ArrowLeft" && !atStart) {
            onIndex(current - 1)
        } else if (event.key === "ArrowRight" && !atEnd) {
            onIndex(current + 1)
        }
    }

    return (
        <dialog ref={dialogRef} className="photo-viewer" aria-label="Review photo" onClose={onClose} onKeyDown={handleKeyDown}>
            {isOpen && (
                <>
                    <div className="photo-viewer-top">
                        <p>
                            Photo {current + 1} of {photos.length}
                            <small>{caption}</small>
                        </p>
                        <button type="button" className="photo-viewer-button" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
                    </div>
                    <div className="photo-viewer-image">
                        <img src={photos[current]} alt={`Photo ${current + 1} from the buyer`} />
                        {photos.length > 1 && (
                            <>
                                <button type="button" className="photo-viewer-button is-previous" aria-label="Previous photo" disabled={atStart} onClick={() => onIndex(current - 1)}>
                                    <ChevronLeft size={20} aria-hidden="true" />
                                </button>
                                <button type="button" className="photo-viewer-button is-next" aria-label="Next photo" disabled={atEnd} onClick={() => onIndex(current + 1)}>
                                    <ChevronRight size={20} aria-hidden="true" />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="photo-viewer-foot">
                        {photos.length > 1 && (
                            <div className="photo-viewer-thumbs">
                                {photos.map((url, position) => (
                                    <button
                                        key={url}
                                        type="button"
                                        className={`photo-viewer-thumb${position === current ? " is-on" : ""}`}
                                        aria-label={`Photo ${position + 1}`}
                                        aria-current={position === current}
                                        onClick={() => onIndex(position)}
                                    >
                                        <img src={url} alt="" />
                                    </button>
                                ))}
                            </div>
                        )}
                        <a href={photos[current]} target="_blank" rel="noopener noreferrer">
                            Open full size<span className="visually-hidden"> (opens in a new tab)</span>
                        </a>
                    </div>
                </>
            )}
        </dialog>
    )
}

export default PhotoViewer
