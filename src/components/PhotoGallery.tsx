import { useRef, useState, type ReactNode } from "react"

type PhotoGalleryProps = {
    photos: string[]
    title: string
    children?: ReactNode// drawn over the large photo, for example a "Sold out" badge
}

// The product page's pictures: one large photo that can be swiped on a phone, with small photos down
// the side on wider screens and dots under it on phones to show which one is open.
function PhotoGallery({ photos, title, children }: PhotoGalleryProps) {
    const [selected, setSelected] = useState(0)
    const trackRef = useRef<HTMLDivElement>(null)
    const index = Math.min(selected, Math.max(photos.length - 1, 0))

    function show(position: number) {
        const track = trackRef.current
        if (!track) {
            return
        }
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        track.scrollTo({ left: position * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" })
        setSelected(position)
    }

    // Swiping moves the track; the open photo is whichever one fills it.
    function handleScroll() {
        const track = trackRef.current
        if (track && track.clientWidth > 0) {
            setSelected(Math.round(track.scrollLeft / track.clientWidth))
        }
    }

    return (
        <div className={photos.length > 1 ? "gallery has-thumbs" : "gallery"}>
            {photos.length > 1 && (
                <ul className="gallery-side">
                    {photos.map((url, position) => (
                        <li key={url}>
                            <button
                                type="button"
                                className={`gallery-thumb${position === index ? " is-selected" : ""}`}
                                aria-label={`Show photo ${position + 1} of ${photos.length}`}
                                aria-pressed={position === index}
                                onClick={() => show(position)}
                            >
                                <img src={url} alt="" loading="lazy" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="gallery-main">
                <div className="gallery-frame">
                    {photos.length > 0 ? (
                        <div className="gallery-track" ref={trackRef} onScroll={handleScroll}>
                            {photos.map((url, position) => (
                                <img
                                    key={url}
                                    src={url}
                                    alt={photos.length > 1 ? `${title}, photo ${position + 1} of ${photos.length}` : title}
                                    loading={position === 0 ? "eager" : "lazy"}
                                />
                            ))}
                        </div>
                    ) : (
                        <span className="gallery-empty" role="img" aria-label="No photo available">No photo</span>
                    )}
                    {children}
                </div>
                {photos.length > 1 && (
                    <div className="gallery-dots" aria-hidden="true">
                        {photos.map((url, position) => <span key={url} className={position === index ? "is-on" : undefined} />)}
                    </div>
                )}
            </div>
        </div>
    )
}

export default PhotoGallery
