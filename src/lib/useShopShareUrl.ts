import { useEffect, useState } from "react"
import { apiFetch } from "./api"

// The shop's share link (GET /seller/shop/:slug profile.shareUrl): pasted into WhatsApp, Instagram or Facebook it
// shows the shop's picture and name, then opens the shop. Until it is known (or if the shop page can't be read),
// the app's own address stands in, which still opens the shop but without a preview.
export function useShopShareUrl(slug: string | null): string | null {
    const [found, setFound] = useState<{ slug: string, url: string } | null>(null)

    useEffect(() => {
        if (!slug) {
            return
        }
        const controller = new AbortController()

        apiFetch(`/seller/shop/${encodeURIComponent(slug)}`, { signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((data: unknown) => {
                const shareUrl = typeof data === "object" && data !== null && "profile" in data && typeof data.profile === "object" && data.profile !== null && "shareUrl" in data.profile
                    ? data.profile.shareUrl
                    : null
                if (!controller.signal.aborted && typeof shareUrl === "string" && shareUrl) {
                    setFound({ slug, url: shareUrl })
                }
            })
            .catch(() => {
                // The app's own address stays.
            })
        return () => controller.abort()
    }, [slug])

    if (!slug) {
        return null
    }

    return found && found.slug === slug ? found.url : `${window.location.origin}/shop/${encodeURIComponent(slug)}`
}
