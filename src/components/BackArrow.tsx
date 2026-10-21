import { Link } from "react-router-dom"
import { ArrowLeftIcon } from "./Icons"

type BackArrowProps = {
    to: string
    // What the arrow does, for screen readers and as a tooltip. It is not drawn on the page.
    label: string
}

// A back arrow with no text, at the top of a page. It goes to a fixed page above this one, so it
// behaves the same however the person arrived.
function BackArrow({ to, label }: BackArrowProps) {
    return (
        <Link to={to} className="back-arrow" aria-label={label} title={label}>
            <ArrowLeftIcon />
        </Link>
    )
}

export default BackArrow
