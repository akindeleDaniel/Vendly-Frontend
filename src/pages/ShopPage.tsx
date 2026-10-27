import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { ArrowRight, MapPin, MessageCircle, Search, Star } from "lucide-react"
import { usePendingCartAdd } from "../lib/usePendingCartAdd"
import type { Listing } from "../types/listing"
import type { UserRole } from "../types/user"
import type { ShopProfile } from "../types/shop"
import ListingCard from "../components/ListingCard"
import Notice from "../components/Notice"
import ReviewsPreview from "../components/ReviewsPreview"
import ShopTrustFacts from "../components/ShopTrustFacts"
import { ShopAnnounce, ShopBar, ShopFooter } from "../components/ShopChrome"
import type { SectionLink } from "../components/ShopChrome"
import { apiFetch } from "../lib/api"
import { useCartCount } from "../lib/useCartCount"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import {
    NEW_IN_COUNT, deliveryHeadline, deliveryRates, deliveryReach, firstParagraph, isRecentlyAdded, newestFirst, scrollToSection,
    shopCategories, shopColorStyle, shopSections, shopSocials
} from "../lib/shopHome"

const PAGE_SIZE = 12// products shown at first, and added by "Show more products"
const RATES_SHOWN = 4

type ShopPageProps = {
    userRole: UserRole | null
}

// A shop's own home page: its colour, banner, categories, newest products, story, every product,
// reviews, delivery fees and a footer, like a standalone shop website.
function ShopPage ({ userRole }: ShopPageProps) {
    const { slug } = useParams()
    const [profile, setProfile] = useState<ShopProfile | null>(null)
    const [profileSlug, setProfileSlug] = useState<string | null>(null)
    useDocumentTitle(profile ? profile.businessName : "Shop")
    const [listings, setListings] = useState<Listing[]>([])
    const [notFoundSlug, setNotFoundSlug] = useState<string | null>(null)
    const pendingCartResult = usePendingCartAdd(userRole)// adds the product a visitor chose before logging in
    const [loadError, setLoadError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [searchText, setSearchText] = useState("")
    const [category, setCategory] = useState("")// "" shows every category
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const [showAllRates, setShowAllRates] = useState(false)
    const cartCount = useCartCount(userRole, pendingCartResult)// checked again after a product chosen before logging in is added
    const { hash } = useLocation()

    useEffect(() => {
        if (!slug) {
            return
        }
        const shopSlug = slug
        const controller = new AbortController()

        async function fetchShop() {
            setNotFoundSlug(null)
            setLoadError("")

            try {
                const response = await apiFetch(`/seller/shop/${encodeURIComponent(shopSlug)}`, { signal: controller.signal })
                if (!response.ok) {
                    if (!controller.signal.aborted) {
                        if (response.status === 404) {
                            setNotFoundSlug(shopSlug)
                        } else {
                            setLoadError("We could not load this shop right now. Please try again.")
                        }
                    }
                    return
                }

                const data = await response.json()

                if (controller.signal.aborted) {
                    return
                }
                setProfile(data.profile)
                setProfileSlug(shopSlug)
                setListings(data.listings)
            } catch {
                if (!controller.signal.aborted) {
                    setLoadError("We could not load this shop. Please check your connection and try again.")
                }
            }
        }

        fetchShop()
        return () => controller.abort()
    }, [slug, loadAttempt])

    // A link from a product page (for example /shop/adunni#shop-reviews) opens the shop at that part,
    // once the shop has loaded and the part exists.
    useEffect(() => {
        if (hash && profileSlug === slug) {
            const frame = window.requestAnimationFrame(() => scrollToSection(hash.slice(1)))
            return () => window.cancelAnimationFrame(frame)
        }
    }, [hash, profileSlug, slug])

    const categories = useMemo(() => shopCategories(listings), [listings])
    const newIn = useMemo(() => newestFirst(listings).slice(0, NEW_IN_COUNT), [listings])

    // Search and the category buttons only narrow "All products"; the rest of the page stays as it is.
    const search = searchText.trim().toLowerCase()
    const matching = listings.filter((listing) =>
        (category === "" || listing.category === category) &&
        (search === "" || listing.title.toLowerCase().includes(search))
    )

    function chooseCategory(name: string) {
        setCategory(name)
        setVisibleCount(PAGE_SIZE)
    }

    const jumpTo = scrollToSection

    // A link to a section of this page that glides there instead of jumping.
    const sectionLink: SectionLink = (id) => ({
        href: `#${id}`,
        onClick: (event) => {
            event.preventDefault()
            jumpTo(id)
        }
    })

    if (notFoundSlug === slug) {
        return (
            <div>
                <h1>Store not found</h1>
                <p>We could not find that shop. It may have been renamed or removed.</p>
                <Link to="/">Keep browsing</Link>
            </div>
        )
    }

    if (!profile || profileSlug !== slug) {
        if (loadError) {
            return (
                <div>
                    <h1>Shop</h1>
                    <Notice kind="error">
                        <p>{loadError}</p>
                        <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
                    </Notice>
                    <Link to="/">Keep browsing</Link>
                </div>
            )
        }

        return (
            <div className="shop-home shop-loading" aria-busy="true">
                <p role="status" className="visually-hidden">Loading the shop...</p>
                <div className="skeleton shop-loading-hero" />
                <div className="shop-wrap shop-loading-row">
                    <div className="skeleton" /><div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
                </div>
            </div>
        )
    }

    const branding = profile.branding
    const about = branding?.about?.trim() ?? ""
    const intro = firstParagraph(about)
    const whatsapp = branding?.whatsapp ?? null
    const socials = shopSocials(profile)
    const headline = deliveryHeadline(profile)
    const rates = deliveryRates(profile)
    const ratingCount = profile.ratingCount ?? 0
    const initial = profile.businessName.charAt(0).toUpperCase()
    const sections = shopSections(profile, listings.length)
    const showCategories = categories.length >= 2
    const showNewIn = sections.some((section) => section.id === "shop-new")
    const showAbout = sections.some((section) => section.id === "shop-about")
    const foodNote = profile.foodOrderType === "PRE_ORDER"
        ? "Food is by pre-order only: ask for a ready time at checkout."
        : profile.foodOrderType === "BOTH" ? "Takes pre-orders for food as well as orders for now." : ""

    const whatsappButton = (className: string) => whatsapp && (
        <a className={className} href={whatsapp.url} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" size={18} />
            Chat on WhatsApp<span className="visually-hidden"> (opens in a new tab)</span>
        </a>
    )

    const heroText = (
        <>
            <h1 id="shop-name">{profile.businessName}</h1>
            {intro && <p className="shop-hero-intro">{intro}</p>}
            <p className="shop-hero-facts">
                {ratingCount > 0 && typeof profile.ratingAverage === "number" && (
                    <span><Star aria-hidden="true" size={16} className="shop-star" />{profile.ratingAverage.toFixed(1)} from {ratingCount} {ratingCount === 1 ? "review" : "reviews"}</span>
                )}
                {profile.location && <span><MapPin aria-hidden="true" size={16} />{profile.location}</span>}
            </p>
            {foodNote && <p className="shop-hero-note">{foodNote}</p>}
            <div className="shop-actions">
                <a className="shop-btn is-inverse" {...sectionLink("shop-all")}>Shop now</a>
                {whatsappButton("shop-btn is-inverse-outline")}
            </div>
        </>
    )

    return (
        <div className="shop-home" style={shopColorStyle(branding?.brandColor)}>
            <ShopAnnounce headline={headline} />

            <ShopBar
                profile={profile}
                sections={sections}
                sectionLink={sectionLink}
                homeLink={{ href: "#shop-name", onClick: (event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }) } }}
                onSearch={() => jumpTo("shop-all", "shop-search")}
                userRole={userRole}
                cartCount={cartCount}
            />

            {pendingCartResult && (
                <div className="shop-wrap">
                    <p role={pendingCartResult.isError ? "alert" : "status"} className={`alert ${pendingCartResult.isError ? "alert-error" : "alert-success"}`}>
                        {pendingCartResult.text}
                        {!pendingCartResult.isError && <>{" "}<Link to="/cart">View cart</Link></>}
                    </p>
                </div>
            )}

            {branding?.bannerUrl ? (
                <section className="shop-hero" aria-labelledby="shop-name">
                    <img className="shop-hero-img" src={branding.bannerUrl} alt="" width="1800" height="600" />
                    <div className="shop-hero-over">
                        <div className="shop-wrap">
                            <div className="shop-hero-card">{heroText}</div>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="shop-hero-plain" aria-labelledby="shop-name">
                    <div className="shop-wrap">
                        {profile.logoUrl
                            ? <img className="shop-hero-logo" src={profile.logoUrl} alt="" />
                            : <span className="shop-hero-logo is-initial" aria-hidden="true">{initial}</span>}
                        {heroText}
                    </div>
                </section>
            )}

            {profile.trust && (
                <section className="shop-wrap shop-trust" aria-label="This shop's record">
                    <ShopTrustFacts trust={profile.trust} cards />
                </section>
            )}

            {showCategories && (
                <section className="shop-wrap shop-section" aria-labelledby="shop-cats-heading">
                    <h2 id="shop-cats-heading" className="shop-heading">Shop by category</h2>
                    <ul className="shop-cats">
                        {categories.map((entry) => (
                            <li key={entry.name}>
                                <button type="button" className="shop-cat" onClick={() => { chooseCategory(entry.name); jumpTo("shop-all") }}>
                                    {entry.imageUrl ? <img src={entry.imageUrl} alt="" loading="lazy" /> : <span className="shop-cat-empty" aria-hidden="true" />}
                                    <span className="shop-cat-label">
                                        {entry.name}
                                        <small>{entry.count} {entry.count === 1 ? "item" : "items"}</small>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {showNewIn && (
                <section id="shop-new" className="shop-wrap shop-section" aria-labelledby="shop-new-heading">
                    <div className="shop-section-head">
                        <h2 id="shop-new-heading" className="shop-heading">New in</h2>
                        <a className="shop-see-all" {...sectionLink("shop-all")}>See everything<ArrowRight aria-hidden="true" size={18} /></a>
                    </div>
                    <ul className="product-grid">
                        {newIn.map((listing) => (
                            <li key={listing.id} className="shop-product">
                                <ListingCard isEditable={false} allowAddToCart listing={listing} />
                                {isRecentlyAdded(listing) && <span className="shop-new-badge">New</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {showAbout && (
                <section id="shop-about" className="shop-wrap shop-section" aria-labelledby="shop-about-heading">
                    <div className="shop-story">
                        <p className="shop-eyebrow">About the shop</p>
                        <h2 id="shop-about-heading" className="shop-heading">{profile.businessName}</h2>
                        {about && <p className="shop-story-text">{about}</p>}
                        <div className="shop-actions">
                            {whatsappButton("shop-btn is-brand")}
                            {socials.map((social) => (
                                <a key={social.name} className="shop-btn is-plain" href={social.url} target="_blank" rel="noopener noreferrer">
                                    {social.name}<span className="visually-hidden"> (@{social.handle}, opens in a new tab)</span>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section id="shop-all" className="shop-wrap shop-section" aria-labelledby="shop-all-heading">
                <div className="shop-section-head">
                    <h2 id="shop-all-heading" className="shop-heading">All products</h2>
                    <span className="shop-count">{listings.length} {listings.length === 1 ? "product" : "products"}</span>
                </div>
                <div className="shop-tools">
                    <form role="search" className="search-form shop-search" onSubmit={(event) => event.preventDefault()}>
                        <label className="search-field">
                            <span className="visually-hidden">Search this shop</span>
                            <Search aria-hidden="true" size={20} />
                            <input
                                id="shop-search"
                                type="search"
                                placeholder={`Search ${profile.businessName}`}
                                value={searchText}
                                onChange={(event) => { setSearchText(event.currentTarget.value); setVisibleCount(PAGE_SIZE) }}
                            />
                        </label>
                    </form>
                    {categories.length >= 2 && (
                        <div className="shop-chips" role="group" aria-label="Category">
                            <button type="button" className="shop-chip" aria-pressed={category === ""} onClick={() => chooseCategory("")}>All</button>
                            {categories.map((entry) => (
                                <button key={entry.name} type="button" className="shop-chip" aria-pressed={category === entry.name} onClick={() => chooseCategory(entry.name)}>
                                    {entry.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {listings.length === 0 && <p>This shop has no products yet.</p>}
                {listings.length > 0 && matching.length === 0 && <p role="status">No products match your search.</p>}
                {matching.length > 0 && (
                    <ul className="product-grid">
                        {matching.slice(0, visibleCount).map((listing) => (
                            <li key={listing.id} className="shop-product">
                                <ListingCard isEditable={false} allowAddToCart listing={listing} />
                            </li>
                        ))}
                    </ul>
                )}
                {matching.length > visibleCount && (
                    <div className="shop-more">
                        <button type="button" className="shop-btn is-plain" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                            Show more products
                        </button>
                    </div>
                )}
            </section>

            <section id="shop-reviews" className="shop-wrap shop-section" aria-labelledby="shop-reviews-heading">
                <ReviewsPreview kind="shop" subject={profile.slug} heading="What buyers say" headingId="shop-reviews-heading" />
            </section>

            <section id="shop-delivery" className="shop-wrap shop-section shop-help" aria-label="Delivery and help">
                <div className="shop-panel">
                    <h2 className="shop-panel-title">Where we deliver</h2>
                    <p className="shop-muted">{deliveryReach(profile)}</p>
                    {rates.length > 0 ? (
                        <>
                            <ul className="shop-rates-list">
                                {(showAllRates ? rates : rates.slice(0, RATES_SHOWN)).map((rate) => (
                                    <li key={rate.state}><span>{rate.state}</span><b>{rate.fee}</b></li>
                                ))}
                            </ul>
                            {rates.length > RATES_SHOWN && (
                                <button type="button" className="btn-text shop-see-all" aria-expanded={showAllRates} onClick={() => setShowAllRates((open) => !open)}>
                                    {showAllRates ? "Show fewer" : `See all ${rates.length} delivery fees`}
                                </button>
                            )}
                        </>
                    ) : (
                        headline && <p>{headline}</p>
                    )}
                </div>
                <div className="shop-panel is-tinted">
                    <h2 className="shop-panel-title">Questions before you buy?</h2>
                    {whatsapp
                        ? <p>Ask {profile.businessName} about sizes, colours or delivery times on WhatsApp.</p>
                        : <p>Look through the reviews above, or check the product page for details and stock.</p>}
                    {whatsappButton("shop-btn is-brand")}
                    <p className="shop-muted shop-safety">Always pay through StoreHatch checkout, never by bank transfer in a chat. That way your order is covered if something goes wrong.</p>
                </div>
            </section>

            <ShopFooter profile={profile} sections={sections} sectionLink={sectionLink} userRole={userRole} />
        </div>
    )
}

export default ShopPage
