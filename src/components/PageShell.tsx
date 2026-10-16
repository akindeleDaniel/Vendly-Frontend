import { useEffect } from "react"
import { useLocation } from "react-router-dom"

// First thing a keyboard user reaches: jumps past the header to the page content.
export function SkipLink() {
    return (
        <a
            className="skip-link"
            href="#main"
            onClick={(event) => {
                event.preventDefault()
                document.getElementById("main")?.focus()
            }}
        >
            Skip to main content
        </a>
    )
}

// A new page starts at the top, as on a normal website. Only the path matters: changing a search
// or category on the same page keeps the scroll position.
export function ScrollToTop() {
    const { pathname } = useLocation()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [pathname])

    return null
}
