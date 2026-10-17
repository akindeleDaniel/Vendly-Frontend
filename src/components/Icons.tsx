// Small stroke icons used across the browsing pages. They are decorative: the text next to them
// carries the meaning, so they are hidden from screen readers.

type IconProps = {
    size?: number
}

function Icon({ size = 20, children }: IconProps & { children: React.ReactNode }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {children}
        </svg>
    )
}

export function ChevronRightIcon({ size }: IconProps) {
    return <Icon size={size}><polyline points="9,6 15,12 9,18" /></Icon>
}

export function ChevronLeftIcon({ size = 18 }: IconProps) {
    return <Icon size={size}><polyline points="15,6 9,12 15,18" /></Icon>
}

export function SearchIcon({ size }: IconProps) {
    return (
        <Icon size={size}>
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </Icon>
    )
}

export function HomeIcon({ size }: IconProps) {
    return (
        <Icon size={size}>
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10v10h5v-6h4v6h5V10" />
        </Icon>
    )
}

export function RotateIcon({ size }: IconProps) {
    return (
        <Icon size={size}>
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21,4 21,10 15,10" />
        </Icon>
    )
}

export function MapPinIcon({ size = 16 }: IconProps) {
    return (
        <Icon size={size}>
            <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
        </Icon>
    )
}
