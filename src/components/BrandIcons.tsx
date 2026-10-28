// Small icons for WhatsApp and the social networks, which lucide-react does not include. They are drawn to sit
// with the lucide line icons and are decorative: the link or button around them says what they are.

type BrandIconProps = {
    size?: number
}

function Svg({ size = 20, filled = false, children }: BrandIconProps & { filled?: boolean, children: React.ReactNode }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? "currentColor" : "none"}
            stroke={filled ? "none" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {children}
        </svg>
    )
}

// The WhatsApp mark: a round speech bubble with a phone handset inside.
export function WhatsAppIcon({ size }: BrandIconProps) {
    return (
        <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 2.6a9.4 9.4 0 0 0-8.1 14.2L2.6 21.4l4.7-1.2A9.4 9.4 0 1 0 12 2.6z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
            <path fill="currentColor" d="M8.7 7.3c.2-.4.5-.5.8-.5h.5c.2 0 .4.1.5.4l.8 1.9c.1.2.1.5 0 .7l-.5.7c-.1.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.1.6 0l.7-.6c.2-.2.5-.2.7-.1l1.9.9c.3.1.4.3.4.6 0 1-.7 1.8-1.6 2-.9.2-2.1 0-3.8-1-1.6-.9-2.9-2.2-3.8-3.8-.6-1.1-.8-2-.8-2.7 0-.6.2-1.1.5-1.6z" />
        </svg>
    )
}

export function InstagramIcon({ size }: BrandIconProps) {
    return <Svg size={size}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></Svg>
}

export function TikTokIcon({ size }: BrandIconProps) {
    return <Svg size={size}><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2.4 4.6 5 5" /></Svg>
}

export function FacebookIcon({ size }: BrandIconProps) {
    return <Svg size={size}><path d="M15 3h-2a4 4 0 0 0-4 4v3H7v3h2v8h3v-8h2.5l.5-3h-3V7a1 1 0 0 1 1-1h2z" /></Svg>
}

export function XIcon({ size }: BrandIconProps) {
    return <Svg size={size}><path d="M4 4l16 16M20 4L4 20" /></Svg>
}

// The icon for a social network by the name shopSocials gives it.
export function SocialIcon({ name, size }: BrandIconProps & { name: string }) {
    switch (name) {
        case "Instagram":
            return <InstagramIcon size={size} />
        case "TikTok":
            return <TikTokIcon size={size} />
        case "Facebook":
            return <FacebookIcon size={size} />
        default:
            return <XIcon size={size} />
    }
}
