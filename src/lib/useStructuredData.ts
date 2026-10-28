import { useEffect } from "react"

// Puts details Google can read (schema.org JSON-LD from the backend) into the page while it is open, for example a
// product's price, stock and star rating, and removes them again when the page closes.
export function useStructuredData(data?: object | null) {
    useEffect(() => {
        if (!data) {
            return
        }

        const script = document.createElement("script")
        script.type = "application/ld+json"
        // textContent is never read as HTML; "<" is escaped as well, as the backend does, so the text cannot end the tag.
        script.textContent = JSON.stringify(data).replace(/</g, "\\u003c")
        document.head.appendChild(script)

        return () => script.remove()
    }, [data])
}
