import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { ExternalLink, MoreHorizontal, Pencil, Plus, RotateCcw, ShoppingBag, Trash2 } from "lucide-react"
import Notice from "./Notice"
import { apiRequest, failureMessage } from "../lib/apiRequest"
import { STOCK_MAX } from "../lib/limits"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { describeAlert, lowOptionName, sellerStockStatus } from "../lib/stock"
import type { Listing } from "../types/listing"

type StoreProductRowProps = {
    listing: Listing
    isArchived: boolean
    canRestock?: boolean // on the Running low and Sold out tabs, a product without options can be restocked here
    onDelete: () => void
    onRestore: () => void
    onRestocked?: () => void
}

// "3 sizes" or "2 colours, 4 sizes": what a product's options add up to.
function describeOptions(listing: Listing): string | null {
    const options = listing.options ?? []
    if (!listing.hasOptions || options.length === 0) {
        return null
    }
    const sizes = new Set(options.flatMap((option) => option.sizes.map((size) => size.label)))
    const hasSizesOnly = options.length === 1 && sizes.size > 0
    const parts = [
        ...(hasSizesOnly ? [] : [`${options.length} ${options.length === 1 ? "option" : "options"}`]),
        ...(sizes.size > 0 ? [`${sizes.size} ${sizes.size === 1 ? "size" : "sizes"}`] : [])
    ]
    return parts.join(", ")
}

// A small form in the row for a new stock count, so restocking needs no trip to the edit page.
function RestockForm({ listing, onDone, onCancel }: { listing: Listing, onDone: () => void, onCancel: () => void }) {
    const id = useId()
    const [value, setValue] = useState(String(listing.stockQuantity))
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")

    async function save(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        const quantity = Number(value)

        if (value.trim() === "" || !Number.isInteger(quantity) || quantity < 0 || quantity > STOCK_MAX) {
            setError(`Enter a whole number from 0 to ${STOCK_MAX.toLocaleString("en-NG")}.`)
            return
        }

        setIsSaving(true)
        setError("")
        // The backend's own message shows when the count is below what shoppers have reserved.
        const result = await apiRequest<unknown>(`/listings/${listing.id}`, { method: "PATCH", body: { stockQuantity: quantity } })
        setIsSaving(false)

        if (result.kind === "ok") {
            onDone()
        } else if (result.kind !== "unauthorized") {
            setError(failureMessage(result))
        }
    }

    return (
        <form className="store-restock" onSubmit={save} aria-label={`Update stock for ${listing.title}`}>
            <p>How many do you have now? Shoppers can buy them straight away.</p>
            <div className="product-field">
                <label htmlFor={id}>In stock</label>
                <input id={id} className="product-input" type="number" min="0" max={STOCK_MAX} step="1" inputMode="numeric" value={value} disabled={isSaving} onChange={(event) => setValue(event.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
            <button type="button" className="btn" disabled={isSaving} onClick={onCancel}>Cancel</button>
            {error && <Notice kind="error">{error}</Notice>}
        </form>
    )
}

// One product in My store's list: its photo, name, price, stock and its low-stock alert, and status,
// with Edit and a menu for the rest (view it in the shop, delete it or, once archived, put it back on
// sale). Options that are running out are named under the product.
function StoreProductRow({ listing, isArchived, canRestock = false, onDelete, onRestore, onRestocked }: StoreProductRowProps) {
    const [isRestocking, setIsRestocking] = useState(false)
    const price = `${listing.hasPriceRange ? "From " : ""}${formatMinorUnits(toMinorUnits(listing.price))}`
    const options = describeOptions(listing)
    const stockStatus = sellerStockStatus(listing)
    const isSoldOut = stockStatus === "sold_out"
    const isLow = stockStatus === "low"
    const lowOptions = listing.lowStockOptions ?? []
    const status = isArchived
        ? { label: "Archived", tone: "neutral" }
        : isSoldOut ? { label: "Sold out", tone: "bad" } : isLow ? { label: "Running low", tone: "attention" } : { label: "On sale", tone: "done" }
    // A product with options shows its total; the options that are running out are listed by name.
    const stock = isArchived
        ? "—"
        : isSoldOut ? "Sold out" : isLow && !listing.hasOptions ? `${listing.stockQuantity} left` : `${listing.stockQuantity} in stock`
    const alert = isArchived ? null : describeAlert(listing)
    const stockTone = isArchived ? undefined : isSoldOut ? "is-out" : isLow && !listing.hasOptions ? "is-low" : undefined

    return (
        <div className={`store-product${!isArchived && (isLow || isSoldOut) ? " is-attention" : ""}`}>
            {listing.imageUrl
                ? <img className="store-product-photo" src={listing.imageUrl} alt="" loading="lazy" />
                : <span className="store-product-photo" aria-hidden="true"><ShoppingBag size={22} /></span>}
            <div className="store-product-name">
                <b>{listing.title}</b>
                <span>{[listing.category, options].filter(Boolean).join(" · ")}</span>
                {!isArchived && lowOptions.length > 0 && (
                    <ul className="store-low-options" aria-label="Options running out">
                        {lowOptions.map((option) => (
                            <li key={option.listingId} className={option.stockStatus === "sold_out" ? "is-out" : undefined}>
                                {lowOptionName(option)} · {option.stockStatus === "sold_out" ? "Sold out" : `${option.stockQuantity} left`}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div><span className="store-product-label">Price </span><b>{price}</b></div>
            <div className="store-product-stock">
                <span className={stockTone}><span className="store-product-label">Stock </span>{stock}</span>
                {alert && <small>{alert}</small>}
            </div>
            <div><span className={`orders-status is-${status.tone}`}>{status.label}</span></div>
            <div className="store-product-actions">
                {isArchived ? (
                    <button type="button" className="btn" onClick={onRestore}><RotateCcw size={16} aria-hidden="true" />Put back on sale</button>
                ) : (
                    <Link to={`/seller/products/${listing.id}/edit`} className="store-icon-button" aria-label={`Edit ${listing.title}`}>
                        <Pencil size={18} aria-hidden="true" />
                    </Link>
                )}
                <details className="store-more">
                    <summary className="store-icon-button" aria-label={`More for ${listing.title}`}>
                        <MoreHorizontal size={18} aria-hidden="true" />
                    </summary>
                    <div className="store-more-menu">
                        {!isArchived && (
                            <Link to={`/product/${listing.id}`}><ExternalLink size={16} aria-hidden="true" />See it in your shop</Link>
                        )}
                        <button type="button" className="is-danger" onClick={onDelete}><Trash2 size={16} aria-hidden="true" />Delete</button>
                    </div>
                </details>
            </div>
            {canRestock && !isArchived && !listing.hasOptions && (
                isRestocking
                    ? <RestockForm listing={listing} onDone={() => { setIsRestocking(false); onRestocked?.() }} onCancel={() => setIsRestocking(false)} />
                    : (
                        <div className="store-restock-open">
                            <button type="button" className="btn" onClick={() => setIsRestocking(true)}><Plus size={16} aria-hidden="true" />Update stock</button>
                        </div>
                    )
            )}
        </div>
    )
}

export default StoreProductRow
