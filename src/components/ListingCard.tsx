import { Link, useNavigate } from "react-router-dom"
import type { Listing } from "../types/listing"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { describeStock } from "../lib/stock"
import StarRating from "./StarRating"

type ListingCardProps = {
  listing: Listing
  shopLinkSearch?: string // query string kept on the shop link so the shop page can return to the same search
  allowAddToCart?: boolean // on a storefront the card opens the product's page, where it is added to the cart
}

// A product as shoppers see it in a shop or a list. Sellers add and edit products on their own page
// (ProductFormPage), not on this card.
function ListingCard({ listing, shopLinkSearch, allowAddToCart }: ListingCardProps) {
  const navigate = useNavigate()
  const stock = describeStock(listing.stockQuantity)

  const shopPath = listing.sellerSlug
    ? `/shop/${encodeURIComponent(listing.sellerSlug)}${shopLinkSearch ? `?${shopLinkSearch}` : ""}`
    : null

  // On a storefront the card opens the product's own page; on the browsing pages it opens the shop.
  const productPath = allowAddToCart ? `/product/${listing.id}` : null
  const linkPath = productPath ?? shopPath

  function handleCardClick() {
    if (linkPath) {
      navigate(linkPath)
    }
  }

  return (
    <div className="product-card">
      {/* The whole card opens the page (pointer cursor); the title is a real link so keyboard users can too. */}
      <div className={`product-link-area${linkPath ? " is-clickable" : ""}`} onClick={handleCardClick}>
        <div className="product-media">
          {listing.imageUrl
            ? <img src={listing.imageUrl} alt={listing.title} loading="lazy" />
            : <span role="img" aria-label="No photo available">No photo</span>}
          {stock.isSoldOut && <span className="badge badge-amber product-badge">Sold out</span>}
        </div>
        <div className="product-body">
          <h3 className="product-title">
            {linkPath ? <Link to={linkPath} onClick={(event) => event.stopPropagation()}>{listing.title}</Link> : listing.title}
          </h3>
          <p className="product-price">{listing.hasPriceRange ? "From " : ""}{formatMinorUnits(toMinorUnits(listing.price))}</p>
          {listing.hasOptions && <p className="product-meta">Several options</p>}
          {(listing.deliveredCount ?? 0) > 0 && <p className="product-meta">Delivered to {listing.deliveredCount} {listing.deliveredCount === 1 ? "buyer" : "buyers"}</p>}
          {(listing.ratingCount ?? 0) > 0 && <p className="product-meta"><StarRating average={listing.ratingAverage} count={listing.ratingCount} /></p>}
          {!allowAddToCart && listing.sellerName && <p className="product-meta">Sold by {listing.sellerName}</p>}
          {allowAddToCart && (
            <p className={stock.isLow ? "product-meta product-meta-warning" : "product-meta"}>{stock.label}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ListingCard
