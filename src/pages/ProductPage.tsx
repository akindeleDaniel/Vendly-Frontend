import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Check, ChevronRight, MessageCircle, ShieldCheck, ShoppingBag, Truck } from "lucide-react"
import { ChevronLeftIcon } from "../components/Icons"
import ListingCard from "../components/ListingCard"
import Notice from "../components/Notice"
import OptionPicker from "../components/OptionPicker"
import PhotoGallery from "../components/PhotoGallery"
import ReviewsPreview from "../components/ReviewsPreview"
import StarRating from "../components/StarRating"
import { ShopAnnounce, ShopBar, ShopFooter } from "../components/ShopChrome"
import type { SectionLink } from "../components/ShopChrome"
import { apiFetch } from "../lib/api"
import { buyableChoice, findChoiceById, hasOptions } from "../lib/listingOptions"
import { photosOf } from "../lib/listingPhotos"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { deliveryHeadline, deliverySummary, newestFirst, scrollToSection, shopColorStyle, shopSections } from "../lib/shopHome"
import { describeStock } from "../lib/stock"
import { useAddToCart } from "../lib/useAddToCart"
import { useCartCount } from "../lib/useCartCount"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { useStructuredData } from "../lib/useStructuredData"
import { usePendingCartAdd } from "../lib/usePendingCartAdd"
import type { Listing } from "../types/listing"
import type { ShopProfile } from "../types/shop"
import type { AuthStatus, UserRole } from "../types/user"

const MORE_COUNT = 4

type ProductPageProps = {
    userRole: UserRole | null
    authStatus: AuthStatus
}

type LoadState =
    | { kind: "loading" }
    | { kind: "ready", listing: Listing }
    | { kind: "not-found" }
    | { kind: "error", message: string }

type ShopData = { slug: string, profile: ShopProfile, listings: Listing[] }

// The WhatsApp chat with the product's name and link already typed in.
function askAboutUrl(chatUrl: string, title: string): string {
    try {
        const url = new URL(chatUrl)
        url.searchParams.set("text", `Hi, I have a question about "${title}": ${window.location.href}`)
        return url.toString()
    } catch {
        return chatUrl
    }
}

// One product on its own page, inside its shop's website: the shop's colour, header and footer around
// large photos, the options, Add to cart, delivery, the seller, reviews and more from the same shop.
// The product request does not carry the shop's look, so the shop is loaded alongside it; if that
// fails the product still shows, in StoreHatch's own colours.
function ProductPage({ userRole, authStatus }: ProductPageProps) {
    const { id = "" } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const [attempt, setAttempt] = useState(0)
    const [shop, setShop] = useState<ShopData | null>(null)
    const listing = state.kind === "ready" ? state.listing : null
    // What the shopper has picked among a product's options. A link to one choice opens the product with it chosen.
    const [pickedOption, setPickedOption] = useState<string | null>(null)
    const [pickedSize, setPickedSize] = useState<string | null>(null)
    const initialChoice = listing ? findChoiceById(listing.options, listing.selectedListingId) : null
    const optionLabel = pickedOption ?? initialChoice?.optionLabel ?? null
    const sizeLabel = pickedOption !== null ? pickedSize : initialChoice?.sizeLabel ?? null
    const selectedOption = listing?.options?.find((option) => option.label === optionLabel) ?? null
    const selectedSize = selectedOption?.sizes.find((size) => size.label === sizeLabel) ?? null
    const choice = buyableChoice(selectedOption, selectedSize)
    // A product with options is bought through the chosen option or size, never itself.
    const cartTarget = listing && hasOptions(listing) ? choice : listing
    const cart = useAddToCart(cartTarget, userRole, authStatus === "unauthenticated")
    const pendingResult = usePendingCartAdd(userRole)
    const cartCount = useCartCount(userRole, `${cart.feedback?.kind}|${pendingResult?.text}`)
    useDocumentTitle(listing ? listing.title : "Product")
    useStructuredData(listing?.structuredData)

    useEffect(() => {
        const controller = new AbortController()

        async function loadProduct() {
            try {
                const response = await apiFetch(`/listings/${encodeURIComponent(id)}`, { signal: controller.signal })

                if (controller.signal.aborted) {
                    return
                }

                if (response.status === 404 || response.status === 400) {
                    setState({ kind: "not-found" })
                    return
                }

                if (!response.ok) {
                    setState({ kind: "error", message: "We could not load this product right now. Please try again." })
                    return
                }

                setState({ kind: "ready", listing: await response.json() })
            } catch {
                if (!controller.signal.aborted) {
                    setState({ kind: "error", message: "We could not load this product. Please check your connection and try again." })
                }
            }
        }

        loadProduct()
        return () => controller.abort()
    }, [id, attempt])

    // The shop around the product: its colour, header, delivery fees and other products.
    const shopSlug = listing?.sellerSlug ?? null
    useEffect(() => {
        if (!shopSlug) {
            return
        }
        const controller = new AbortController()

        apiFetch(`/seller/shop/${encodeURIComponent(shopSlug)}`, { signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((data: { profile?: ShopProfile, listings?: Listing[] } | null) => {
                if (!controller.signal.aborted && data?.profile) {
                    setShop({ slug: shopSlug, profile: data.profile, listings: data.listings ?? [] })
                }
            })
            .catch(() => {
                // The product still shows, without the shop's look.
            })
        return () => controller.abort()
    }, [shopSlug])

    const shopData = shop && shop.slug === shopSlug ? shop : null
    const moreFromShop = useMemo(
        () => shopData ? newestFirst(shopData.listings.filter((other) => other.id !== listing?.id)).slice(0, MORE_COUNT) : [],
        [shopData, listing?.id]
    )

    // Back goes to where the shopper came from. A product opened straight from a link has nowhere to
    // go back to, so it goes to the home page.
    function goBack() {
        if (location.key !== "default") {
            navigate(-1)
        } else {
            navigate("/")
        }
    }

    const backButton = (
        <button type="button" className="back-link" onClick={goBack}>
            <ChevronLeftIcon />
            Back
        </button>
    )

    if (state.kind === "loading") {
        return (
            <div className="shop-home product-home" aria-busy="true">
                <p role="status" className="visually-hidden">Loading the product...</p>
                <div className="shop-wrap product-layout">
                    <div className="skeleton product-loading-photo" />
                    <div className="product-loading-lines">
                        <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
                    </div>
                </div>
            </div>
        )
    }

    if (state.kind === "not-found") {
        return (
            <div>
                {backButton}
                <h1>Product not found</h1>
                <p>We could not find that product. It may have been removed.</p>
                <Link to="/">Keep browsing</Link>
            </div>
        )
    }

    if (state.kind === "error") {
        return (
            <div>
                {backButton}
                <h1>Product</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((count) => count + 1) }}>Try again</button>
                </Notice>
            </div>
        )
    }

    const product = state.listing
    const withOptions = hasOptions(product)
    const stock = describeStock(withOptions && choice ? choice.stockQuantity : product.stockQuantity)
    const showCartControls = true// every account can buy; the backend refuses a seller's own products
    const needsChoice = withOptions && choice === null
    const photos = photosOf(product)
    const optionPhoto = selectedOption?.imageUrl ?? null
    const shownPhotos = optionPhoto ? [optionPhoto, ...photos.filter((url) => url !== optionPhoto)] : photos
    const shownPrice = withOptions && selectedOption ? selectedOption.price : product.price
    const priceText = `${!selectedOption && product.hasPriceRange ? "From " : ""}${formatMinorUnits(toMinorUnits(shownPrice))}`
    const maxQuantity = cartTarget?.stockQuantity ?? 0
    const profile = shopData?.profile ?? null
    const shopPath = product.sellerSlug ? `/shop/${encodeURIComponent(product.sellerSlug)}` : null
    const whatsapp = profile?.branding?.whatsapp ?? null
    // The backend's message names the price and links to the product; the shop's own chat link is the fallback.
    const enquiryUrl = product.whatsappEnquiry?.url ?? (whatsapp ? askAboutUrl(whatsapp.url, product.title) : null)
    const trust = product.shopTrust
    const sellerFacts = [
        trust && (trust.confirmedDeliveries > 0 ? `${trust.confirmedDeliveries.toLocaleString("en-NG")} ${trust.confirmedDeliveries === 1 ? "order" : "orders"} delivered` : "New shop"),
        trust?.payoutVerified && "Payout verified",
        profile?.location
    ].filter(Boolean).join(" · ")
    const choiceNote = selectedOption ? `${selectedOption.label}${selectedSize ? `, size ${selectedSize.label}` : ""}` : product.title
    const stockText = needsChoice
        ? (selectedOption ? "Choose a size to see what is left." : "Choose an option to see what is left.")
        : stock.label
    const stockClass = needsChoice || stock.isSoldOut ? "product-stock" : stock.isLow ? "product-stock is-low" : "product-stock is-ok"
    const buttonLabel = needsChoice
        ? (selectedOption ? "Choose a size" : "Choose an option")
        : stock.isSoldOut ? "Sold out" : cart.isAdding ? "Adding..." : "Add to cart"

    // With a choice still to make, the button takes the shopper to the choices instead of doing nothing.
    function handleAdd() {
        if (needsChoice) {
            scrollToSection("product-options")
            document.querySelector<HTMLButtonElement>("#product-options button:not(:disabled)")?.focus({ preventScroll: true })
            return
        }
        cart.addToCart()
    }

    // Links to parts of the shop's home page open it there.
    const toShop: SectionLink = (sectionId) => ({
        href: `${shopPath}#${sectionId}`,
        onClick: (event) => {
            event.preventDefault()
            navigate(`${shopPath}#${sectionId}`)
        }
    })
    const sections = profile ? shopSections(profile, shopData?.listings.length ?? 0) : []

    return (
        <div className="shop-home product-home" style={shopColorStyle(profile?.branding?.brandColor)}>
            {profile && shopPath && (
                <>
                    <ShopAnnounce headline={deliveryHeadline(profile)} />
                    <ShopBar
                        profile={profile}
                        sections={sections}
                        sectionLink={toShop}
                        homeLink={{ href: shopPath, onClick: (event) => { event.preventDefault(); navigate(shopPath) } }}
                        onSearch={() => navigate(`${shopPath}#shop-all`)}
                        userRole={userRole}
                        cartCount={cartCount}
                    />
                </>
            )}

            <div className="shop-wrap">
                {pendingResult && (
                    <p role={pendingResult.isError ? "alert" : "status"} className={`alert ${pendingResult.isError ? "alert-error" : "alert-success"}`}>
                        {pendingResult.text}
                        {!pendingResult.isError && <>{" "}<Link to="/cart">View cart</Link></>}
                    </p>
                )}

                <nav className="product-crumbs" aria-label="You are here">
                    {shopPath && product.sellerName && (
                        <>
                            <Link to={shopPath}>{product.sellerName}</Link>
                            <ChevronRight aria-hidden="true" size={14} />
                            <Link to={`${shopPath}#shop-all`}>{product.category}</Link>
                            <ChevronRight aria-hidden="true" size={14} />
                        </>
                    )}
                    <span aria-current="page">{product.title}</span>
                </nav>

                <article className="product-layout">
                    <PhotoGallery key={optionLabel ?? "product"} photos={shownPhotos} title={product.title}>
                        {stock.isSoldOut && !needsChoice && <span className="badge badge-amber product-badge">Sold out</span>}
                    </PhotoGallery>

                    <div className="product-info">
                        <div>
                            <p className="shop-eyebrow">{product.category}</p>
                            <h1 className="product-title-lg">{product.title}</h1>
                            <p className="product-facts">
                                {(product.ratingCount ?? 0) > 0 && (
                                    <a href="#product-reviews" onClick={(event) => { event.preventDefault(); scrollToSection("product-reviews") }}>
                                        <StarRating average={product.ratingAverage} count={product.ratingCount} />
                                    </a>
                                )}
                                {(product.deliveredCount ?? 0) > 0 && (
                                    <span>Delivered to {product.deliveredCount} {product.deliveredCount === 1 ? "buyer" : "buyers"}</span>
                                )}
                            </p>
                        </div>

                        <p className="product-price-lg">{priceText}</p>

                        {withOptions && product.options && (
                            <div id="product-options">
                                <OptionPicker
                                    options={product.options}
                                    optionLabel={optionLabel}
                                    sizeLabel={sizeLabel}
                                    onOption={(label) => { setPickedOption(label); setPickedSize(null) }}
                                    onSize={(label) => { setPickedOption(optionLabel); setPickedSize(label) }}
                                />
                            </div>
                        )}
                        <p className={stockClass}>{stockText}</p>

                        {showCartControls && (
                            <div className="product-buy">
                                {!needsChoice && !stock.isSoldOut && maxQuantity > 1 && (
                                    <div className="qty-stepper" role="group" aria-label={`Quantity for ${product.title}`}>
                                        <button type="button" aria-label="One fewer" disabled={cart.quantity <= 1} onClick={() => cart.setQuantity(cart.quantity - 1)}>−</button>
                                        <output aria-live="polite">{cart.quantity}</output>
                                        <button type="button" aria-label="One more" disabled={cart.quantity >= maxQuantity} onClick={() => cart.setQuantity(cart.quantity + 1)}>+</button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="shop-btn is-brand product-add"
                                    onClick={handleAdd}
                                    disabled={cart.isAdding || (stock.isSoldOut && !needsChoice)}
                                >
                                    <ShoppingBag aria-hidden="true" size={20} />
                                    {buttonLabel}
                                </button>
                            </div>
                        )}
                        {cart.feedback && (
                            cart.feedback.kind === "success" ? (
                                <p role="status" className="product-added">
                                    <span><Check aria-hidden="true" size={18} />Added {cart.quantity} to your cart.</span>
                                    <Link to="/cart">View cart</Link>
                                </p>
                            ) : (
                                <p role="status" className={`alert alert-${cart.feedback.kind}`}>{cart.feedback.text}</p>
                            )
                        )}

                        <div className="product-boxes">
                            <div className="product-box">
                                <ShieldCheck aria-hidden="true" size={22} className="is-safe" />
                                <div>
                                    <b>Protected purchase</b>
                                    <p>You pay through StoreHatch. If your order does not arrive or is not what was described, raise a complaint from My orders.</p>
                                </div>
                            </div>
                            {profile && (
                                <div className="product-box">
                                    <Truck aria-hidden="true" size={22} />
                                    <div>
                                        <b>{deliverySummary(profile)}</b>
                                        <p>
                                            You see the exact fee for your state at checkout.{" "}
                                            <a {...toShop("shop-delivery")}>See all fees</a>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {product.sellerName && shopPath && (
                            <div className="product-seller">
                                {profile?.logoUrl
                                    ? <img className="shop-brand-logo" src={profile.logoUrl} alt="" />
                                    : <span className="shop-brand-logo is-initial" aria-hidden="true">{product.sellerName.charAt(0).toUpperCase()}</span>}
                                <div className="product-seller-text">
                                    <span>Sold by</span>
                                    <b>{product.sellerName}</b>
                                    {sellerFacts && <span>{sellerFacts}</span>}
                                </div>
                                <div className="product-seller-actions">
                                    <Link className="shop-btn is-plain is-small" to={shopPath}>Visit shop</Link>
                                    {enquiryUrl && (
                                        <a className="shop-btn is-plain is-small" href={enquiryUrl} target="_blank" rel="noopener noreferrer">
                                            <MessageCircle aria-hidden="true" size={16} />
                                            Ask on WhatsApp<span className="visually-hidden"> (opens in a new tab)</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="product-details">
                            <details open>
                                <summary>About this product</summary>
                                <p>{product.description}</p>
                            </details>
                            <details>
                                <summary>Delivery and complaints</summary>
                                <p>Delivery fees depend on your state and are shown at checkout. Once your order arrives, confirm it in My orders. If something is wrong, raise a complaint there.</p>
                            </details>
                        </div>
                    </div>
                </article>

                <section id="product-reviews" className="shop-section" aria-labelledby="product-reviews-heading">
                    <ReviewsPreview kind="product" subject={String(product.id)} heading="Reviews of this product" headingId="product-reviews-heading" />
                </section>

                {moreFromShop.length > 0 && shopPath && (
                    <section className="shop-section product-more" aria-labelledby="product-more-heading">
                        <div className="shop-section-head">
                            <h2 id="product-more-heading" className="shop-heading">More from {product.sellerName}</h2>
                            <Link className="shop-see-all" to={shopPath}>Visit the shop<ArrowRight aria-hidden="true" size={18} /></Link>
                        </div>
                        <ul className="product-grid">
                            {moreFromShop.map((other) => (
                                <li key={other.id} className="shop-product">
                                    <ListingCard allowAddToCart listing={other} />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {profile && <ShopFooter profile={profile} sections={sections} sectionLink={toShop} userRole={userRole} />}

            {showCartControls && (
                <div className="product-buybar">
                    <div>
                        <span>{choiceNote}</span>
                        <b>{priceText}</b>
                    </div>
                    <button
                        type="button"
                        className="shop-btn is-brand"
                        onClick={handleAdd}
                        disabled={cart.isAdding || (stock.isSoldOut && !needsChoice)}
                    >
                        {buttonLabel}
                    </button>
                </div>
            )}
        </div>
    )
}

export default ProductPage
