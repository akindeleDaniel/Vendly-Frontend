import { useEffect } from "react"
import { BRAND_NAME } from "./brand"

// Sets the browser tab title for the current page, for example "Your cart · StoreHatch".
// Without a title it falls back to just the site name.
export function useDocumentTitle(title?: string | null) {
    useEffect(() => {
        document.title = title ? `${title} · ${BRAND_NAME}` : BRAND_NAME
    }, [title])
}
