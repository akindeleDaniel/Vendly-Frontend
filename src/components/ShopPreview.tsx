import type { ReactNode } from "react"
import { MapPin, MessageCircle } from "lucide-react"
import ShopAvatar from "./ShopAvatar"
import { BRAND_COLORS } from "../types/branding"
import type { BrandingForm } from "../types/branding"

const SOCIAL_NAMES: Array<{ key: "instagram" | "tiktok" | "facebook" | "x", name: string }> = [
    { key: "instagram", name: "Instagram" },
    { key: "tiktok", name: "TikTok" },
    { key: "facebook", name: "Facebook" },
    { key: "x", name: "X" }
]

type ShopPreviewProps = {
    label: string
    businessName: string
    state: string
    lga: string
    branding: BrandingForm
    logoUrl: string | null
    bannerUrl: string | null
    children?: ReactNode // shown under the preview, such as a link or a tip
}

// The top of the shop page as shoppers will see it, updated as the seller types. Used while setting
// up a shop and in Shop details.
function ShopPreview({ label, businessName, state, lga, branding, logoUrl, bannerUrl, children }: ShopPreviewProps) {
    const color = BRAND_COLORS.find((choice) => choice.key === branding.brandColor) ?? BRAND_COLORS[0]
    const socials = SOCIAL_NAMES.flatMap((social) => {
        const handle = branding[social.key].trim().replace(/^@/, "")
        return handle ? [`${social.name} @${handle}`] : []
    })
    const place = lga ? [lga, state === "Federal Capital Territory" ? "FCT" : state].filter(Boolean).join(", ") : ""

    return (
        <aside className="product-form-aside" aria-label="Preview">
            <p className="settings-peek-label">{label}</p>
            <div className="settings-peek">
                <div className={`settings-peek-banner${color.light && !bannerUrl ? " is-light" : ""}`} style={bannerUrl ? undefined : { background: color.background }}>
                    {bannerUrl && <img src={bannerUrl} alt="" />}
                </div>
                <div className="settings-peek-body">
                    <span className="settings-peek-logo">
                        <ShopAvatar name={businessName.trim() || "?"} logoUrl={logoUrl} brandColor={color} />
                    </span>
                    <p className="settings-peek-name">{businessName.trim() || "Your shop name"}</p>
                    {place && <p className="settings-peek-place"><MapPin size={14} aria-hidden="true" />{place}</p>}
                    {branding.about.trim() && <p className="settings-peek-about" style={{ background: color.tint }}>{branding.about.trim()}</p>}
                    {socials.length > 0 && (
                        <div className="settings-peek-social">
                            {socials.map((social) => <span key={social}>{social}</span>)}
                        </div>
                    )}
                    {branding.whatsappNumber.trim() && (
                        <span className={`settings-peek-button${color.light ? " is-light" : ""}`} style={{ background: color.background, color: color.text }}>
                            <MessageCircle size={16} aria-hidden="true" />Chat on WhatsApp
                        </span>
                    )}
                </div>
            </div>
            {children}
        </aside>
    )
}

export default ShopPreview
