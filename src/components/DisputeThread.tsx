import { formatOrderDay } from "../lib/buyerOrders"
import type { DisputeAuthor, DisputeMessage } from "../types/dispute"
import type { DisputeViewer } from "../lib/disputeApi"

type Names = { shop?: string | null, buyer?: string | null }

function authorLabel(author: DisputeAuthor, viewer: DisputeViewer, names: Names): string {
    switch (author) {
        case "BUYER":
            return viewer === "buyer" ? "You" : names.buyer || "The buyer"
        case "SELLER":
            return viewer === "seller" ? "You" : names.shop || "The seller"
        case "ADMIN":
            return "StoreHatch"
        case "SYSTEM":
            return "StoreHatch (automatic)"
    }
}

// The messages of a complaint, oldest first, as a conversation: the viewer's own on the right,
// the other side's on the left and StoreHatch's in the middle, each with any photos attached.
function DisputeThread({ messages, viewer, names = {} }: { messages: DisputeMessage[], viewer: DisputeViewer, names?: Names }) {
    if (messages.length === 0) {
        return <p className="field-help">No messages yet.</p>
    }

    return (
        <ol className="thread">
            {messages.map((message) => {
                const isOwn = (message.author === "BUYER" && viewer === "buyer") || (message.author === "SELLER" && viewer === "seller")
                const kind = message.author === "SYSTEM" ? "is-system" : message.author === "ADMIN" ? "is-storehatch" : isOwn ? "is-own" : "is-other"
                const author = authorLabel(message.author, viewer, names)

                return (
                    <li key={message.id} className={`thread-message ${kind}`}>
                        <div className="thread-meta">
                            <strong>{author}</strong>
                            <time dateTime={message.createdAt}>{formatOrderDay(message.createdAt, { time: true })}</time>
                        </div>
                        <p className="thread-body">{message.body}</p>
                        {message.evidenceUrls.length > 0 && (
                            <ul className="thread-evidence">
                                {message.evidenceUrls.filter((url) => url.startsWith("https://")).map((url, index) => (
                                    <li key={url}>
                                        <a href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt={`Photo ${index + 1} attached by ${author === "You" ? "you" : author}`} loading="lazy" />
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
