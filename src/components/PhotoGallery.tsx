import { useState, type ReactNode } from "react"

type PhotoGalleryProps = {
    photos: string[]
    title: string
    children?: ReactNode// drawn over the large photo, for example a "Sold out" badge
}

// The product page's pictures: one large photo and, when there are several, a row of small ones to
// switch between.
function PhotoGallery({ photos, title, children }: PhotoGalleryProps) {
    const [selected, setSelected] = useState(0)
    const index = Math.min(selected, Math.max(photos.length - 1, 0))

    return (
        <div className="product-detail-gallery">
            <div className="product-detail-media">
                {photos.length > 0
                    ? <img src={photos[index]} alt={photos.length > 1 ? `${title}, photo ${index + 1} of ${photos.length}` : title} />
                    : <span role="img" aria-label="No photo available">No photo</span>}
                {children}
            </div>
            {photos.length > 1 && (
                <ul className="gallery-thumbs">
                    {photos.map((url, position) => (
                        <li key={url}>
                            <button
                                type="button"
                                className={`gallery-thumb${position === index ? " is-selected" : ""}`}
                                aria-label={`Show photo ${position + 1} of ${photos.length}`}
                                aria-pressed={position === index}
                                onClick={() => setSelected(position)}
                            >
                                <img src={url} alt="" loading="lazy" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default PhotoGallery
