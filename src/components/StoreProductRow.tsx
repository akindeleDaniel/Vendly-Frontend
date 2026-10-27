import { Link } from "react-router-dom"
import { ExternalLink, MoreHorizontal, Pencil, RotateCcw, ShoppingBag, Trash2 } from "lucide-react"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { LOW_STOCK_THRESHOLD } from "../lib/stock"
import type { Listing } from "../types/listing"

type StoreProductRowProps = {
    listing: Listing
    isArchived: boolean
    onDelete: () => void
    onRestore: () => void
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

// One product in My store's list: its photo, name, price, stock and status, with Edit and a menu
// for the rest (view it in the shop, delete it or, once archived, put it back on sale).
function StoreProductRow({ listing, isArchived, onDelete, onRestore }: StoreProductRowProps) {
    const price = `${listing.hasPriceRange ? "From " : ""}${formatMinorUnits(toMinorUnits(listing.price))}`
    const options = describeOptions(listing)
    const isSoldOut = listing.stockQuantity === 0
    const isLow = !isSoldOut && listing.stockQuantity <= LOW_STOCK_THRESHOLD
    const status = isArchived
        ? { label: "Archived", tone: "neutral" }
        : isSoldOut ? { label: "Sold out", tone: "bad" } : isLow ? { label: "Running low", tone: "attention" } : { label: "On sale", tone: "done" }
    const stock = isArchived ? "—" : isSoldOut ? "Sold out" : isLow ? `${listing.stockQuantity} left` : `${listing.stockQuantity} in stock`

    return (
        <div className="store-product">
            {listing.imageUrl
                ? <img className="store-product-photo" src={listing.imageUrl} alt="" loading="lazy" />
                : <span className="store-product-photo" aria-hidden="true"><ShoppingBag size={22} /></span>}
            <div className="store-product-name">
                <b>{listing.title}</b>
                <span>{[listing.category, options].filter(Boolean).join(" · ")}</span>
            </div>
            <div><span className="store-product-label">Price </span><b>{price}</b></div>
            <div className={isSoldOut && !isArchived ? "is-out" : isLow && !isArchived ? "is-low" : undefined}>
                <span className="store-product-label">Stock </span>{stock}
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
        </div>
    )
}

export default StoreProductRow
