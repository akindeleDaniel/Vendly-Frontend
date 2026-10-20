import { formatShortDate } from "../lib/orderApi"
import type { DisputeAuthor, DisputeMessage } from "../types/dispute"
import type { DisputeViewer } from "../lib/disputeApi"

function authorLabel(author: DisputeAuthor, viewer: DisputeViewer): string {
    switch (author) {
        case "BUYER":
            return viewer === "buyer" ? "You" : "The buyer"
        case "SELLER":
            return viewer === "seller" ? "You" : "The seller"
        case "ADMIN":
            return "Vendly"
        case "SYSTEM":
            return "Vendly (automatic)"
    }
}

// The messages of a complaint, oldest first, each with any photos that were attached.
function DisputeThread({ messages, viewer }: { messages: DisputeMessage[], viewer: DisputeViewer }) {
    if (messages.length === 0) {
        return <p className="field-help">No messages yet.</p>
    }

    return (
        <ol className="thread">
            {messages.map((message) => {
                const isOwn = (message.author === "BUYER" && viewer === "buyer") || (message.author === "SELLER" && viewer === "seller")
                const isVendly = message.author === "ADMIN" || message.author === "SYSTEM"

                return (
                    <li key={message.id} className={`thread-message${isOwn ? " is-own" : ""}${isVendly ? " is-vendly" : ""}`}>
                        <div className="thread-meta">
                            <strong>{authorLabel(message.author, viewer)}</strong>
                            <time dateTime={message.createdAt}>{formatShortDate(message.createdAt)}</time>
                        </div>
                        <p className="thread-body">{message.body}</p>
                        {message.evidenceUrls.length > 0 && (
                            <ul className="thread-evidence">
                                {message.evidenceUrls.filter((url) => url.startsWith("https://")).map((url, index) => (
                                    <li key={url}>
                                        <a href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt={`Photo ${index + 1} attached by ${authorLabel(message.author, viewer).toLowerCase()}`} loading="lazy" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                )
            })}
        </ol>
    )
}

export default DisputeThread
