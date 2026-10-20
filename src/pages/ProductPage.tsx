import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ChevronLeftIcon } from "../components/Icons"
import Notice from "../components/Notice"
import { apiFetch } from "../lib/api"
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
    const cart = useAddToCart(listing, userRole, authStatus === "unauthenticated")
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
    const stock = describeStock(product.stockQuantity)
    const showCartControls = userRole !== "SELLER"

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
                <div className="product-detail-media">
                    {product.imageUrl
                        ? <img src={product.imageUrl} alt={product.title} />
                        : <span role="img" aria-label="No photo available">No photo</span>}
                    {stock.isSoldOut && <span className="badge badge-amber product-badge">Sold out</span>}
                </div>

                <div className="product-detail-info">
                    <h1>{product.title}</h1>
                    <p className="product-detail-price">{formatMinorUnits(toMinorUnits(product.price))}</p>
                    <p className="product-detail-tags">
                        <span className="badge">{product.category}</span>
                    </p>
                    <p className={stock.isLow ? "product-meta product-meta-warning" : "product-meta"}>{stock.label}</p>
                    {product.sellerName && product.sellerSlug && (
                        <p className="product-meta">
                            Sold by <Link to={`/shop/${encodeURIComponent(product.sellerSlug)}`}>{product.sellerName}</Link>
                        </p>
                    )}

                    <h2 className="order-section-title">About this product</h2>
                    <p className="product-detail-description">{product.description}</p>

                    {showCartControls && (
                        <div className="product-actions">
                            {!stock.isSoldOut && (
                                <select
                                    aria-label={`Quantity for ${product.title}`}
                                    value={cart.quantity}
                                    onChange={(event) => cart.setQuantity(Number(event.currentTarget.value))}
                                >
                                    {Array.from({ length: product.stockQuantity }, (_, index) => index + 1).map((option) => (
                                        <option key={option} value={option}>Quantity: {option}</option>
                                    ))}
                                </select>
                            )}
                            <button
                                type="button"
                                className={stock.isSoldOut ? undefined : "btn btn-primary"}
                                onClick={cart.addToCart}
                                disabled={cart.isAdding || stock.isSoldOut}
                            >
                                {stock.isSoldOut ? "Sold out" : cart.isAdding ? "Adding..." : "Add to cart"}
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
        </div>
    )
}

export default ProductPage
