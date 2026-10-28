import { Link } from "react-router-dom"
import type { Listing } from "../types/listing"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { describeStock } from "../lib/stock"
import StarRating from "./StarRating"

// A product on the browsing pages: a large photo, the name, the price, its rating (or "No reviews yet"), how many
// buyers it was delivered to, and the shop. The whole tile opens the product's page, inside its shop.
function ProductTile({ listing }: { listing: Listing }) {
    const isSoldOut = describeStock(listing.stockQuantity).isSoldOut && !listing.hasOptions

    return (
        <Link to={`/product/${listing.id}`} className="product-tile">
            <span className="product-tile-photo">
                {listing.imageUrl
                    ? <img src={listing.imageUrl} alt="" loading="lazy" />
                    : <span className="product-tile-nophoto">No photo</span>}
                {isSoldOut && <span className="badge badge-amber product-badge">Sold out</span>}
            </span>
            <span className="product-tile-name">{listing.title}</span>
            <span className="product-tile-price">
                {listing.hasPriceRange ? "From " : ""}{formatMinorUnits(toMinorUnits(listing.price))}
            </span>
            <span className="product-tile-meta">
                <StarRating average={listing.ratingAverage} count={listing.ratingCount} showEmpty />
                {(listing.deliveredCount ?? 0) > 0 && <span className="is-good">Delivered {listing.deliveredCount?.toLocaleString("en-NG")}</span>}
            </span>
            {listing.sellerName && <span className="product-tile-shop">{listing.sellerName}</span>}
        </Link>
    )
}

export default ProductTile
