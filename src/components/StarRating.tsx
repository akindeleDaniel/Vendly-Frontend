type StarRatingProps = {
    average: number | null | undefined
    count: number | null | undefined
    // Leave the count out of the words when the page shows it elsewhere.
    showCount?: boolean
}

function describe(average: number, count: number, showCount: boolean): string {
    return showCount
        ? `Rated ${average.toFixed(1)} out of 5, from ${count} ${count === 1 ? "review" : "reviews"}`
        : `${average} out of 5 stars`
}

// Five stars, filled to the average, with the number of reviews. Nothing is drawn until the first review.
function StarRating({ average, count, showCount = true }: StarRatingProps) {
    if (average === null || average === undefined || !count) {
        return null
    }

    const filled = Math.round(average)

    return (
        <span className="star-rating" role="img" aria-label={describe(average, count, showCount)}>
            <span className="stars" aria-hidden="true">{"★".repeat(filled)}<span className="stars-empty">{"★".repeat(5 - filled)}</span></span>
            <span className="star-rating-text" aria-hidden="true">{showCount ? `${average.toFixed(1)} (${count})` : ""}</span>
        </span>
    )
}

export default StarRating
