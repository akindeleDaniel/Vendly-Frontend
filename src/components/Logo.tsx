import { Link } from "react-router-dom"

// The Vendly mark (a V with an amber dot) and wordmark, linking home. The text is hidden from
// screen readers because the link already has the accessible name "Vendly home".
function Logo() {
    return (
        <Link to="/" className="brand" aria-label="Vendly home">
            <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
                <rect width="64" height="64" rx="16" fill="#174B3A" />
                <polyline points="17,21 30,45 41,25" fill="none" stroke="#F8F5EF" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="48" cy="16" r="4.5" fill="#D98B45" />
            </svg>
            <span className="brand-name" aria-hidden="true">vendly</span>
        </Link>
    )
}

export default Logo
