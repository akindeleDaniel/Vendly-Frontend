import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ChevronLeftIcon } from "../components/Icons"
import Notice from "../components/Notice"
import OptionPicker from "../components/OptionPicker"
import PhotoGallery from "../components/PhotoGallery"
import ReviewList from "../components/ReviewList"
import StarRating from "../components/StarRating"
import { apiFetch } from "../lib/api"
import { buyableChoice, findChoiceById, hasOptions } from "../lib/listingOptions"
import { photosOf } from "../lib/listingPhotos"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { describeStock } from "../lib/stock"
import { useAddToCart } from "../lib/useAddToCart"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { usePendingCartAdd } from "../lib/usePendingCartAdd"
import type { Listing } from "../types/listing"
import type { AuthStatus, UserRole } from "../types/user"

type ProductPageProps = {
    userRole: UserRole | null
    authStatus: AuthStatus
}

type LoadState =
    | { kind: "loading" }
    | { kind: "ready", listing: Listing }
    | { kind: "not-found" }
    | { kind: "error", message: string }

// One product on its own page: a larger photo, the full description, stock and Add to cart. It is
// the same Add to cart as on a storefront card, including the trip through login for a visitor.
function ProductPage({ userRole, authStatus }: ProductPageProps) {
    const { id = "" } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const [attempt, setAttempt] = useState(0)
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
    useDocumentTitle(listing ? listing.title : "Product")

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
        return <p role="status">Loading the product...</p>
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
    const showCartControls = userRole !== "SELLER"
    const needsChoice = withOptions && choice === null
    const photos = photosOf(product)
    const optionPhoto = selectedOption?.imageUrl ?? null
    const shownPhotos = optionPhoto ? [optionPhoto, ...photos.filter((url) => url !== optionPhoto)] : photos
    const shownPrice = withOptions && selectedOption ? selectedOption.price : product.price
    const maxQuantity = cartTarget?.stockQuantity ?? 0

    return (
        <div>
            {backButton}

            {pendingResult && (
                <p role={pendingResult.isError ? "alert" : "status"} className={`alert ${pendingResult.isError ? "alert-error" : "alert-success"}`}>
                    {pendingResult.text}
                    {!pendingResult.isError && <>{" "}<Link to="/cart">View cart</Link></>}
                </p>
            )}

            <article className="card product-detail">
                <PhotoGallery key={optionLabel ?? "product"} photos={shownPhotos} title={product.title}>
                    {stock.isSoldOut && <span className="badge badge-amber product-badge">Sold out</span>}
                </PhotoGallery>

                <div className="product-detail-info">
                    <h1>{product.title}</h1>
                    <p className="product-detail-price">
                        {!selectedOption && product.hasPriceRange ? "From " : ""}{formatMinorUnits(toMinorUnits(shownPrice))}
                    </p>
                    <p className="product-detail-tags">
                        <span className="badge">{product.category}</span>
                    </p>
                    {(product.ratingCount ?? 0) > 0 && <p className="product-meta"><StarRating average={product.ratingAverage} count={product.ratingCount} /></p>}
                    {withOptions && product.options && (
                        <OptionPicker
                            options={product.options}
                            optionLabel={optionLabel}
                            sizeLabel={sizeLabel}
                            onOption={(label) => { setPickedOption(label); setPickedSize(null) }}
                            onSize={(label) => { setPickedOption(optionLabel); setPickedSize(label) }}
                        />
                    )}
                    <p className={stock.isLow && !needsChoice ? "product-meta product-meta-warning" : "product-meta"}>
                        {needsChoice ? (selectedOption ? "Choose a size to see what is left." : "Choose an option to see what is left.") : stock.label}
                    </p>
                    {product.sellerName && product.sellerSlug && (
                        <p className="product-meta">
                            Sold by <Link to={`/shop/${encodeURIComponent(product.sellerSlug)}`}>{product.sellerName}</Link>
                        </p>
                    )}

                    <h2 className="order-section-title">About this product</h2>
                    <p className="product-detail-description">{product.description}</p>

                    {showCartControls && (
                        <div className="product-actions">
                            {!needsChoice && !stock.isSoldOut && (
                                <select
                                    aria-label={`Quantity for ${product.title}`}
                                    value={cart.quantity}
                                    onChange={(event) => cart.setQuantity(Number(event.currentTarget.value))}
                                >
                                    {Array.from({ length: maxQuantity }, (_, index) => index + 1).map((option) => (
                                        <option key={option} value={option}>Quantity: {option}</option>
                                    ))}
                                </select>
                            )}
                            <button
                                type="button"
                                className={stock.isSoldOut || needsChoice ? undefined : "btn btn-primary"}
                                onClick={cart.addToCart}
                                disabled={cart.isAdding || needsChoice || stock.isSoldOut}
                            >
                                {needsChoice ? (selectedOption ? "Choose a size" : "Choose an option") : stock.isSoldOut ? "Sold out" : cart.isAdding ? "Adding..." : "Add to cart"}
                            </button>
                            {cart.feedback && (
                                <p role="status" className={`alert alert-${cart.feedback.kind}`}>
                                    {cart.feedback.text}
                                    {cart.feedback.kind === "success" && <>{" "}<Link to="/cart">View cart</Link></>}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </article>

            <ReviewList kind="product" subject={String(product.id)} />
        </div>
    )
}

export default ProductPage
