import { useEffect } from "react"

const SITE_NAME = "Vendly"

// Sets the browser tab title for the current page, for example "Your cart · Vendly".
// Without a title it falls back to just the site name.
export function useDocumentTitle(title?: string | null) {
    useEffect(() => {
        document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME
    }, [title])
}
