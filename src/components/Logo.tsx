import { useId } from "react"
import { Link } from "react-router-dom"
import { BRAND_NAME, BRAND_WORDMARK } from "../lib/brand"

// The StoreHatch logo: a softly lit egg under an amber shop awning, with an amber circle, on a green
// disc. The gradients need ids that are unique on the page, as the logo can appear more than once.
export function LogoBadge({ size = 32 }: { size?: number }) {
    const id = useId().replace(/:/g, "")
    const egg = "M128 48 C166 48 188 104 188 146 C188 182 162 208 128 208 C94 208 68 182 68 146 C68 104 90 48 128 48 Z"
    const awning = "M54 90 Q128 76 202 90 V110 Q183.5 138 165 110 Q146.5 138 128 110 Q109.5 138 91 110 Q72.5 138 54 110 Z"

    return (
        <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="256" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#215F4A" />
                    <stop offset="1" stopColor="#113629" />
                </linearGradient>
                <radialGradient id={`${id}-egg`} cx="0.36" cy="0.28" r="0.85">
                    <stop offset="0" stopColor="#FFFFFF" />
                    <stop offset="0.45" stopColor="#F7F1E6" />
                    <stop offset="1" stopColor="#DCCEB6" />
                </radialGradient>
                <linearGradient id={`${id}-awn`} x1="0" y1="78" x2="0" y2="138" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#EBA866" />
                    <stop offset="0.6" stopColor="#D98B45" />
                    <stop offset="1" stopColor="#B86C30" />
                </linearGradient>
                <radialGradient id={`${id}-dot`} cx="0.35" cy="0.3" r="0.8">
                    <stop offset="0" stopColor="#F4BC82" />
                    <stop offset="0.55" stopColor="#D98B45" />
                    <stop offset="1" stopColor="#B0642A" />
                </radialGradient>
                <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" />
                </filter>
                <clipPath id={`${id}-clip`}>
                    <path d={egg} />
                </clipPath>
            </defs>
            <circle cx="128" cy="128" r="128" fill={`url(#${id}-bg)`} />
            <circle cx="128" cy="128" r="126" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="3" />
            <ellipse cx="128" cy="216" rx="54" ry="9" fill="#06170F" opacity="0.55" filter={`url(#${id}-blur)`} />
            <path d={egg} fill={`url(#${id}-egg)`} />
            <g clipPath={`url(#${id}-clip)`}>
                <path d="M54 96 Q128 82 202 96 V118 Q183.5 146 165 118 Q146.5 146 128 118 Q109.5 146 91 118 Q72.5 146 54 118 Z" fill="#3A1A05" opacity="0.28" filter={`url(#${id}-blur)`} />
            </g>
            <path d={awning} fill={`url(#${id}-awn)`} />
            <path d="M58 92 Q128 79 198 92" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="104" cy="160" rx="10" ry="22" fill="#FFFFFF" opacity="0.35" transform="rotate(18 104 160)" filter={`url(#${id}-blur)`} />
            <circle cx="193" cy="60" r="22.5" fill="#123A2D" />
            <circle cx="193" cy="60" r="19" fill={`url(#${id}-dot)`} />
            <ellipse cx="187" cy="53" rx="6" ry="4" fill="#FFFFFF" opacity="0.45" />
        </svg>
    )
}

// The logo and the wordmark, linking home (larger on the sign-in pages). The text is hidden from
// screen readers because the link already has the accessible name "StoreHatch home".
function Logo({ size = "default" }: { size?: "default" | "large" }) {
    return (
        <Link to="/" className={size === "large" ? "brand brand-large" : "brand"} aria-label={`${BRAND_NAME} home`}>
            <LogoBadge size={size === "large" ? 48 : 32} />
            <span className="brand-name" aria-hidden="true">{BRAND_WORDMARK}</span>
        </Link>
    )
}

export default Logo
