import { useEffect, useRef, useState } from "react"
import { Link2, Share2 } from "lucide-react"
import { WhatsAppIcon } from "./BrandIcons"

type ShareButtonProps = {
    // The share link (shareUrl from the backend), which shows a picture and title when pasted into WhatsApp.
    url: string
    // What is being shared, for the share message: a product or shop name.
    title: string
    label?: string
}

// On a phone, the phone's own share menu opens. On a computer (or a phone without one), a small menu offers
// WhatsApp and Copy link.
function ShareButton({ url, title, label = "Share" }: ShareButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title}: ${url}`)}`

    // The menu closes on a tap outside it or on Escape.
    useEffect(() => {
        if (!isOpen) {
            return
        }

        function onPointer(event: PointerEvent) {
            if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false)
            }
        }

        document.addEventListener("pointerdown", onPointer)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("pointerdown", onPointer)
            document.removeEventListener("keydown", onKey)
        }
    }, [isOpen])

    async function handleClick() {
        const isPhone = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches

        if (isPhone && typeof navigator.share === "function") {
            try {
                await navigator.share({ title, url })
                return
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return// the shopper closed the share menu
                }
            }
        }

        setCopied(false)
        setIsOpen((open) => !open)
    }

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
        } catch {
            setCopied(false)// copying can be blocked; WhatsApp still works
        }
    }

    return (
        <div className="share" ref={wrapRef}>
            <button type="button" className="share-button" aria-expanded={isOpen} aria-haspopup="true" onClick={handleClick}>
                <Share2 size={18} aria-hidden="true" />
                {label}
            </button>
            {isOpen && (
                <div className="share-menu">
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => setIsOpen(false)}>
                        <span className="share-whatsapp"><WhatsAppIcon size={18} /></span>
                        Share on WhatsApp<span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                    <button type="button" onClick={copyLink}>
                        <Link2 size={18} aria-hidden="true" />
                        <span className={copied ? "is-copied" : undefined}>{copied ? "Link copied" : "Copy link"}</span>
                    </button>
                    <span className="visually-hidden" aria-live="polite">{copied ? "Link copied" : ""}</span>
                    <small>The link shows the picture and name when pasted into WhatsApp, Instagram or Facebook.</small>
                </div>
            )}
        </div>
    )
}

export default ShareButton
