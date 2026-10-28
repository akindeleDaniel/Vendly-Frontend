type ReviewPhotoThumbsProps = {
    urls: string[]
    who: string // whose photos, for example "Funke A.'s" or "your"
    onOpen: (index: number) => void
}

// A review's photos as small square buttons that open the large viewer. Nothing is drawn when the
// review has no photos.
function ReviewPhotoThumbs({ urls, who, onOpen }: ReviewPhotoThumbsProps) {
    if (urls.length === 0) {
        return null
    }

    return (
        <div className="review-thumbs">
            {urls.map((url, index) => (
                <button key={url} type="button" className="review-thumb" aria-label={`Open ${who} photo ${index + 1} of ${urls.length}`} onClick={() => onOpen(index)}>
                    <img src={url} alt="" loading="lazy" />
                </button>
            ))}
        </div>
    )
}

export default ReviewPhotoThumbs
