import { useState, useEffect } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { PackageOpen, ShoppingBag } from "lucide-react"
import { markShopSetupPromptDismissed } from "../lib/shopSetupPrompt"
import type { Listing } from "../types/listing"
import { apiFetch } from "../lib/api"
import { apiRequest, failureMessage } from "../lib/apiRequest"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import AddProductsMenu from "../components/AddProductsMenu"
import DraftsPanel from "../components/DraftsPanel"
import Notice from "../components/Notice"
import Greeting from "../components/Greeting"
import SellerStandingNotice from "../components/SellerStandingNotice"
import StoreOverview, { StoreShortcuts } from "../components/StoreOverview"
import type { StoreProfile } from "../components/StoreOverview"
import StoreProductRow from "../components/StoreProductRow"
import { toStoreProfile } from "../lib/storeProfile"
import { LOW_STOCK_THRESHOLD, sellerStockStatus } from "../lib/stock"

type ProductView = "on-sale" | "drafts" | "low" | "sold-out" | "archived"

const VIEWS: ProductView[] = ["on-sale", "drafts", "low", "sold-out", "archived"]

type StockAlertBoxProps = { low: number, soldOut: number, shopAlertNumber: number | null, onShow: () => void }

// Over the products when something is running low or sold out, with the way to them and to the alert number.
function StockAlertBox({ low, soldOut, shopAlertNumber, onShow }: StockAlertBoxProps) {
    const lowText = `${low} ${low === 1 ? "product is" : "products are"} running low`
    const heading = low > 0 && soldOut > 0
        ? `${lowText} and ${soldOut} ${soldOut === 1 ? "is" : "are"} sold out`
        : low > 0 ? lowText : `${soldOut} ${soldOut === 1 ? "product is" : "products are"} sold out`
    const shopNumber = shopAlertNumber ?? LOW_STOCK_THRESHOLD

    return (
        <div className="store-stock-alert" role="status">
            <span className="store-stock-alert-icon" aria-hidden="true"><PackageOpen size={20} /></span>
            <div>
                <b>{heading}</b>
                <p>
                    {shopNumber === 0
                        ? "Low-stock emails are off for your shop, unless a product has its own number."
                        : `We email you when something drops to its alert number, so you can restock before you miss sales. Your shop alerts at ${shopNumber} or fewer.`}
                </p>
                <div className="store-stock-alert-actions">
                    <button type="button" className="btn" onClick={onShow}>See them</button>
                    <Link to="/seller/profile/edit#low-stock" className="btn-text">Change the alert number</Link>
                </div>
            </div>
        </div>
    )
}

// The seller's dashboard: the shop as shoppers see it, what needs the seller, and the products.
// Products are added and edited on their own page (ProductFormPage).
function MyListingsPage({ userName = "" }: { userName?: string }) {
    useDocumentTitle("My store")
    const location = useLocation()
    const addedTitle = typeof location.state === "object" && location.state !== null && "added" in location.state && typeof location.state.added === "string"
        ? location.state.added
        : null
    // A message from the page the seller came from, for example after importing or making drafts.
    const arrivalNote = typeof location.state === "object" && location.state !== null && "note" in location.state && typeof location.state.note === "string"
        ? location.state.note
        : null
    const [searchParams] = useSearchParams()
    const viewParam = searchParams.get("view")

    const [listings, setListings] = useState<Listing[]>([])
    const [profile, setProfile] = useState<StoreProfile | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [view, setView] = useState<ProductView>(VIEWS.find((value) => value === viewParam) ?? "on-sale")
    const [drafts, setDrafts] = useState<Listing[]>([])
    const [archivePrompt, setArchivePrompt] = useState<{ id: number, title: string } | null>(null)
    const [isArchiving, setIsArchiving] = useState(false)
    const [needsShop, setNeedsShop] = useState(false)// no shop yet: products need one, so setup is offered first
    const [shopAlertNumber, setShopAlertNumber] = useState<number | null>(null)// the shop's low-stock alert number

    async function handleDelete(id: number) {
        const listing = [...listings, ...drafts].find((candidate) => candidate.id === id)
        if (!window.confirm(`Delete "${listing?.title ?? "this product"}"? This cannot be undone.`)) {
            return
        }

        setDeleteError("")

        try {
            const response = await apiFetch(`/listings/${id}`, { method: "DELETE", credentials: "include" })

            if (!response.ok) {
                const body: unknown = await response.json().catch(() => null)

                // A product that has been ordered, or is in someone's cart, cannot be deleted. It can be taken
                // off sale instead, which leaves paid orders alone.
                if (response.status === 409 && typeof body === "object" && body !== null && "code" in body && body.code === "LISTING_HAS_HISTORY") {
                    setArchivePrompt({ id, title: listing?.title ?? "this product" })
                    return
                }

                setDeleteError(
                    typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" && body.message
                        ? body.message
                        : `Unable to delete this product (status ${response.status}).`
                )
                return
            }

            setListings((current) => current.filter((candidate) => candidate.id !== id))
            setDrafts((current) => current.filter((candidate) => candidate.id !== id))
        } catch {
            setDeleteError("Something went wrong. Please check your connection and try again.")
        }
    }

    // Takes a product off sale: it is hidden from shoppers and removed from every cart, and paid orders are not touched.
    async function handleArchive() {
        if (archivePrompt === null || isArchiving) {
            return
        }

        setIsArchiving(true)
        const result = await apiRequest<{ listing: Listing }>(`/listings/${archivePrompt.id}/archive`, { method: "POST", body: {} })
        setIsArchiving(false)

        if (result.kind === "ok") {
            setListings((current) => current.map((candidate) => candidate.id === archivePrompt.id ? result.data.listing : candidate))
            setArchivePrompt(null)
            setDeleteError("")
        } else if (result.kind !== "unauthorized") {
            setDeleteError(failureMessage(result))
            setArchivePrompt(null)
        }
    }

    async function handleRestore(id: number) {
        setDeleteError("")
        const result = await apiRequest<{ listing: Listing }>(`/listings/${id}/unarchive`, { method: "POST", body: {} })

        if (result.kind === "ok") {
            setListings((current) => current.map((candidate) => candidate.id === id ? result.data.listing : candidate))
        } else if (result.kind !== "unauthorized") {
            setDeleteError(failureMessage(result))
        }
    }

    useEffect(() => {
        const controller = new AbortController()

        async function loadStore() {
            setLoadError(null)

            try {
                const [profileResponse, listingsResponse, draftsResponse] = await Promise.all([
                    apiFetch("/seller/profile", { credentials: "include", signal: controller.signal }),
                    apiFetch("/listings/Mylisting?archived=all", { credentials: "include", signal: controller.signal }),
                    // Drafts are listed apart from the products on sale. Without them the tab is simply missing.
                    apiFetch("/listings/Mylisting?drafts=only", { credentials: "include", signal: controller.signal }).catch(() => null)
                ])

                if (controller.signal.aborted) {
                    return
                }

                if (profileResponse.status === 404) {// no shop yet: offered on the page, not forced
                    setNeedsShop(true)
                    return
                }

                if (profileResponse.status === 401 || listingsResponse.status === 401) {
                    return// the session guard handles an expired session
                }

                if (!profileResponse.ok || !listingsResponse.ok) {
                    setLoadError("We could not load your store. Please try again.")
                    return
                }

                const profileBody: unknown = await profileResponse.json()
                const myListings: Listing[] = await listingsResponse.json()
                const myDrafts: unknown = draftsResponse?.ok ? await draftsResponse.json().catch(() => []) : []
                if (controller.signal.aborted) {
                    return
                }
                setProfile(toStoreProfile(profileBody))
                const alertNumber = typeof profileBody === "object" && profileBody !== null && "lowStockThreshold" in profileBody ? profileBody.lowStockThreshold : null
                setShopAlertNumber(typeof alertNumber === "number" ? alertNumber : null)
                setListings(myListings)
                setDrafts(Array.isArray(myDrafts) ? myDrafts.filter((draft: Listing) => draft.isDraft !== false) : [])
            } catch {
                if (!controller.signal.aborted) {
                    setLoadError("We could not load your store. Please check your connection and try again.")
                }
            }
        }

        loadStore()
        return () => controller.abort()
    }, [loadAttempt])

    const onSaleListings = listings.filter((listing) => !listing.archivedAt)
    const lowListings = onSaleListings.filter((listing) => sellerStockStatus(listing) === "low")
    const soldOutListings = onSaleListings.filter((listing) => sellerStockStatus(listing) === "sold_out")
    const archivedListings = listings.filter((listing) => listing.archivedAt)
    // An empty tab other than On sale is gone, so the page goes back to the products on sale.
    const showDrafts = view === "drafts" && drafts.length > 0
    const shownListings = view === "archived" && archivedListings.length > 0
        ? archivedListings
        : view === "low" && lowListings.length > 0 ? lowListings
            : view === "sold-out" && soldOutListings.length > 0 ? soldOutListings : onSaleListings
    const shownView: ProductView = showDrafts ? "drafts" : shownListings === onSaleListings ? "on-sale" : view

    // Without a shop there is nothing to list yet: setting one up is required to add a product, and
    // shopping stays open in the meantime.
    if (needsShop) {
        return (
            <div>
                <Greeting name={userName} />
                <section className="card setup-shop" aria-labelledby="setup-shop-heading">
                    <h1 id="setup-shop-heading">Set up your shop to start selling</h1>
                    <p>Add your shop's name, where you are and how you deliver. Then you can add your first products.</p>
                    <div className="action-row">
                        <Link to="/seller/onboarding" className="btn btn-primary btn-lg">Set up my shop</Link>
                        <Link to="/" className="btn btn-lg" onClick={markShopSetupPromptDismissed}>Browse products</Link>
                    </div>
                    <p className="field-help">You can shop on StoreHatch with this same account while you decide.</p>
                </section>
            </div>
        )
    }

    const firstName = userName.trim().split(/\s+/)[0] ?? ""
    const tabs: Array<{ value: ProductView, label: string, count: number }> = [
        { value: "on-sale", label: "On sale", count: onSaleListings.length },
        ...(drafts.length > 0 ? [{ value: "drafts" as const, label: "Drafts", count: drafts.length }] : []),
        ...(lowListings.length > 0 ? [{ value: "low" as const, label: "Running low", count: lowListings.length }] : []),
        ...(soldOutListings.length > 0 ? [{ value: "sold-out" as const, label: "Sold out", count: soldOutListings.length }] : []),
        ...(archivedListings.length > 0 ? [{ value: "archived" as const, label: "Archived", count: archivedListings.length }] : [])
    ]

    return (
        <div className="store-page">
            {loadError && (
                <Notice kind="error">
                    <p>{loadError}</p>
                    <button type="button" className="btn" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
                </Notice>
            )}
            {addedTitle && <Notice kind="success">&ldquo;{addedTitle}&rdquo; is now on sale in your shop.</Notice>}
            {arrivalNote && <Notice kind="success">{arrivalNote}</Notice>}

            <SellerStandingNotice />

            {profile && (
                <StoreOverview firstName={firstName} profile={profile} productsOnSale={onSaleListings.length} productsLow={lowListings.length} />
            )}

            <section aria-labelledby="products-heading">
                <div className="store-section-title">
                    <h2 id="products-heading">Your products</h2>
                    <AddProductsMenu hasProducts={onSaleListings.length > 0} />
                </div>

                {deleteError && <Notice kind="error">{deleteError}</Notice>}
                {archivePrompt && (
                    <Notice kind="warning">
                        <p>
                            &ldquo;{archivePrompt.title}&rdquo; cannot be deleted because it has been ordered or is in a cart. You can archive it instead.
                            It is taken off sale and removed from carts, and orders already paid are not affected. You can restore it later.
                        </p>
                        <div className="action-row">
                            <button type="button" className="btn btn-primary" disabled={isArchiving} onClick={handleArchive}>
                                {isArchiving ? "Archiving..." : "Archive it"}
                            </button>
                            <button type="button" className="btn" disabled={isArchiving} onClick={() => setArchivePrompt(null)}>Cancel</button>
                        </div>
                    </Notice>
                )}

                {shownView === "on-sale" && (lowListings.length > 0 || soldOutListings.length > 0) && (
                    <StockAlertBox low={lowListings.length} soldOut={soldOutListings.length} shopAlertNumber={shopAlertNumber} onShow={() => setView(lowListings.length > 0 ? "low" : "sold-out")} />
                )}

                {tabs.length > 1 && (
                    <div className="orders-filters" aria-label="Show products">
                        {tabs.map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                className={`orders-filter${tab.value === shownView ? " is-active" : ""}`}
                                aria-pressed={tab.value === shownView}
                                onClick={() => setView(tab.value)}
                            >
                                {tab.label}<span className={`orders-filter-count${tab.value === "low" ? " is-low" : tab.value === "sold-out" ? " is-out" : ""}`}>{tab.count}</span>
                            </button>
                        ))}
                    </div>
                )}

                {shownView === "drafts" ? (
                    <DraftsPanel drafts={drafts} onChanged={() => setLoadAttempt((attempt) => attempt + 1)} onDelete={handleDelete} />
                ) : shownListings.length === 0 ? (
                    <div className="store-empty">
                        <span className="store-empty-icon" aria-hidden="true"><ShoppingBag size={30} /></span>
                        <h3>No products yet</h3>
                        <p>Add your first product with a few clear photos, a price and how many you have. You can add options like sizes and colours too.</p>
                        <Link to="/seller/products/new" className="btn btn-primary">Add your first product</Link>
                    </div>
                ) : (
                    <div className="store-products">
                        <div className="store-products-head" aria-hidden="true">
                            <span /><span>Product</span><span>Price</span><span>Stock</span><span>Status</span><span />
                        </div>
                        <ul>
                            {shownListings.map((listing) => (
                                <li key={listing.id}>
                                    <StoreProductRow
                                        listing={listing}
                                        isArchived={shownView === "archived"}
                                        canRestock={shownView === "low" || shownView === "sold-out"}
                                        onRestocked={() => setLoadAttempt((attempt) => attempt + 1)}
                                        onDelete={() => handleDelete(listing.id)}
                                        onRestore={() => handleRestore(listing.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <StoreShortcuts />
        </div>
    )
}

export default MyListingsPage
