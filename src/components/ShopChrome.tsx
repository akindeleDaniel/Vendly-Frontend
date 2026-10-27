import type { MouseEvent } from "react"
import { Link } from "react-router-dom"
import { MapPin, Search, ShoppingBag, Truck } from "lucide-react"
import type { ShopProfile } from "../types/shop"
import type { UserRole } from "../types/user"
import { firstParagraph, shopSocials } from "../lib/shopHome"
import type { ShopSection } from "../lib/shopHome"

// The parts of a shop's own website around its pages: the delivery bar, the shop's header and its
// footer. The shop's home page and its product pages share them, so a shopper stays "inside" the shop.

// What a link to one part of the shop's home page does: glide there on the home page, or open the
// home page at that part from a product page.
export type SectionLink = (id: string) => { href: string, onClick: (event: MouseEvent<HTMLAnchorElement>) => void }

export function ShopAnnounce({ headline }: { headline: string }) {
    if (!headline) {
        return null
    }

    return (
        <p className="shop-announce">
            <Truck aria-hidden="true" size={18} />
            {headline}
        </p>
    )
}

type ShopBarProps = {
    profile: ShopProfile
    sections: ShopSection[]
    sectionLink: SectionLink
    homeLink: { href: string, onClick: (event: MouseEvent<HTMLAnchorElement>) => void }
    onSearch: () => void
    userRole: UserRole | null
    cartCount: number
}

export function ShopBar({ profile, sections, sectionLink, homeLink, onSearch, userRole, cartCount }: ShopBarProps) {
    return (
        <header className="shop-bar">
            <div className="shop-wrap shop-bar-row">
                <a className="shop-brand" {...homeLink}>
                    {profile.logoUrl
                        ? <img className="shop-brand-logo" src={profile.logoUrl} alt="" />
                        : <span className="shop-brand-logo is-initial" aria-hidden="true">{profile.businessName.charAt(0).toUpperCase()}</span>}
                    <span className="shop-brand-name">{profile.businessName}</span>
                </a>
                <nav className="shop-nav" aria-label="Shop">
                    {sections.map((section) => <a key={section.id} {...sectionLink(section.id)}>{section.label}</a>)}
                </nav>
                <div className="shop-bar-tools">
                    <button type="button" className="shop-icon-btn" aria-label="Search this shop" onClick={onSearch}>
                        <Search aria-hidden="true" size={20} />
                    </button>
                    {userRole !== null && (
                        <Link to="/cart" className="shop-icon-btn" aria-label={cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"} title="Cart">
                            <ShoppingBag aria-hidden="true" size={20} />
                            {cartCount > 0 && <span className="shop-cart-count" aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span>}
                        </Link>
                    )}
                </div>
            </div>
            <nav className="shop-nav-scroll" aria-label="Shop sections">
                {sections.map((section) => <a key={section.id} {...sectionLink(section.id)}>{section.label}</a>)}
            </nav>
        </header>
    )
}

type ShopFooterProps = {
    profile: ShopProfile
    sections: ShopSection[]
    sectionLink: SectionLink
    userRole: UserRole | null
}

export function ShopFooter({ profile, sections, sectionLink, userRole }: ShopFooterProps) {
    const intro = firstParagraph(profile.branding?.about)
    const whatsapp = profile.branding?.whatsapp ?? null
    const socials = shopSocials(profile)

    return (
        <footer className="shop-footer">
            <div className="shop-wrap">
                <div className="shop-footer-grid">
                    <div className="shop-footer-about">
                        <p className="shop-footer-name">{profile.businessName}</p>
                        {intro && <p>{intro}</p>}
                        {profile.location && <p className="shop-footer-place"><MapPin aria-hidden="true" size={16} />{profile.location}</p>}
                    </div>
                    <nav aria-label="Shop links">
                        <h2>Shop</h2>
                        <ul>
                            {sections.map((section) => <li key={section.id}><a {...sectionLink(section.id)}>{section.label}</a></li>)}
                        </ul>
                    </nav>
                    {(socials.length > 0 || whatsapp) && (
                        <nav aria-label="Follow the shop">
                            <h2>Follow</h2>
                            <ul>
                                {whatsapp && <li><a href={whatsapp.url} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
                                {socials.map((social) => (
                                    <li key={social.name}><a href={social.url} target="_blank" rel="noopener noreferrer">{social.name}</a></li>
                                ))}
                            </ul>
                        </nav>
                    )}
                    <nav aria-label="Help">
                        <h2>Help</h2>
                        <ul>
                            {userRole !== null && <li><Link to="/orders">My orders</Link></li>}
                            <li><Link to="/">Browse StoreHatch</Link></li>
                        </ul>
                    </nav>
                </div>
                <div className="shop-footer-base">
                    <span>Payments for {profile.businessName} are handled by StoreHatch.</span>
                    <Link to="/seller/register">Start your own shop on StoreHatch</Link>
                </div>
            </div>
        </footer>
    )
}
