import { Link } from "react-router-dom"
import { useDocumentTitle } from "../lib/useDocumentTitle"

// Shown for any address that matches no page, so a mistyped or outdated link is not an empty screen.
function NotFoundPage() {
    useDocumentTitle("Page not found")

    return (
        <div className="form-page-wide">
            <h1>We could not find that page</h1>
            <p>The address may be mistyped, or the page may have moved or been removed.</p>
            <div className="action-row">
                <Link to="/" className="btn btn-primary">Go to the home page</Link>
            </div>
        </div>
    )
}

export default NotFoundPage
