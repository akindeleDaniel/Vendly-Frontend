import type { BrandColor } from "../types/branding"

type ShopAvatarProps = {
    name: string | null | undefined
    logoUrl?: string | null
    brandColor?: BrandColor
}

// A shop's logo, or its first letter on the shop's own colour when it has no logo.
function ShopAvatar({ name, logoUrl, brandColor }: ShopAvatarProps) {
    if (logoUrl) {
        return <img className="shop-avatar" src={logoUrl} alt="" />
    }

    return (
        <span
            className={`shop-avatar${brandColor?.light ? " is-light" : ""}`}
            aria-hidden="true"
            style={brandColor ? { background: brandColor.background, color: brandColor.text } : undefined}
        >
            {(name ?? "?").charAt(0).toUpperCase()}
        </span>
    )
}

export default ShopAvatar
