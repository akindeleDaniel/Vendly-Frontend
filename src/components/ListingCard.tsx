import { Link, useNavigate } from "react-router-dom"
import type { Listing, ListingFormData } from "../types/listing"
import type { UserRole } from "../types/user"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { describeStock } from "../lib/stock"
import { useAddToCart } from "../lib/useAddToCart"
import { CATEGORIES } from "../data/categories"
import { DESCRIPTION_MAX_LENGTH, PRICE_MAX, STOCK_MAX, TITLE_MAX_LENGTH } from "../lib/limits"
import ListingPhotosPicker from "./ListingPhotosPicker"
import type { ListingPhoto } from "../lib/listingPhotos"

type ListingCardProps = {
  listing: Listing
  isEditable: boolean
  userRole?: UserRole | null
  editingId?: number | null
  editFormData?: ListingFormData
  hasChanges?: boolean
  isSaving?: boolean
  saveError?: string
  setEditFormData?: (data: ListingFormData) => void
  editPhotos?: ListingPhoto[]
  setEditPhotos?: (photos: ListingPhoto[]) => void
  handleEditClick?: (listing: Listing) => void
  handleDelete?: (id: number) => void
  isArchived?: boolean // an archived listing is off sale: it can only be restored
  handleRestore?: (id: number) => void
  handleSave?: (id: number) => void
  handleCancel?: () => void
  shopLinkSearch?: string // query string kept on the shop link so the shop page can return to the same search
  allowAddToCart?: boolean // only storefronts offer Add to Cart; browsing pages just link to the storefront
  isLoggedOut?: boolean // true only once the session check has confirmed the visitor is not logged in
}

function ListingCard({ listing, userRole, editingId, editFormData, hasChanges, isSaving, saveError, setEditFormData, editPhotos, setEditPhotos, handleEditClick, handleDelete, isArchived, handleRestore, handleSave, handleCancel, shopLinkSearch, allowAddToCart, isLoggedOut, isEditable}: ListingCardProps) {
  const navigate = useNavigate()
  const {
    quantity: selectedQuantity,
    setQuantity,
    isAdding: isAddingToCart,
    feedback: cartFeedback,
    addToCart: handleAddToCart
  } = useAddToCart(listing, userRole, isLoggedOut)
  const stock = describeStock(listing.stockQuantity)
  const isSoldOut = stock.isSoldOut
  const isLowStock = stock.isLow

  const showCartControls = !isEditable && allowAddToCart && userRole !== "SELLER"

  const shopPath = !isEditable && listing.sellerSlug
    ? `/shop/${encodeURIComponent(listing.sellerSlug)}${shopLinkSearch ? `?${shopLinkSearch}` : ""}`
    : null

  // On a storefront the card opens the product's own page; on the browsing pages it opens the shop.
  const productPath = !isEditable && allowAddToCart ? `/product/${listing.id}` : null
  const linkPath = productPath ?? shopPath

  function handleCardClick(){
    if(linkPath){
      navigate(linkPath)
    }
  }

  const isEditing = listing.id === editingId

  return (
    <div className={`product-card${isEditing ? " product-card-editing" : ""}`}>
      {isEditing ? (
        <>
          <label>
            Title
            <input name="title" maxLength={TITLE_MAX_LENGTH} value={editFormData!.title}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Description
            <textarea name="description" maxLength={DESCRIPTION_MAX_LENGTH} value={editFormData!.description}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Price
            <input name="price" inputMode="decimal" max={PRICE_MAX} value={editFormData!.price}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Stock Quantity
            <input type="number" min="0" max={STOCK_MAX} step="1" required name="stockQuantity"
              value={editFormData!.stockQuantity}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Category
            <select
              name="category"
              value={editFormData!.category}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <ListingPhotosPicker photos={editPhotos!} onChange={(photos) => setEditPhotos!(photos)} disabled={isSaving} />
          {saveError && <p role="alert" className="alert alert-error">{saveError}</p>}
          {isEditable && <button type="button" className="btn btn-primary" onClick={() => handleSave!(listing.id)} disabled={!hasChanges || isSaving}>{isSaving ? "Saving..." : "Save"}</button>}
          {isEditable && <button type="button" onClick={handleCancel} disabled={isSaving}>Cancel</button>}
        </>
      ) : (
        <>
          {/* The whole card opens the shop (pointer cursor); the title is a real link so keyboard users can too. */}
          <div
            className={`product-link-area${linkPath ? " is-clickable" : ""}`}
            onClick={handleCardClick}
          >
            <div className="product-media">
              {listing.imageUrl
                ? <img src={listing.imageUrl} alt={listing.title} loading="lazy" />
                : <span role="img" aria-label="No photo available">No photo</span>}
              {isArchived
                ? <span className="badge product-badge">Archived</span>
                : isSoldOut && <span className="badge badge-amber product-badge">Sold out</span>}
            </div>
            <div className="product-body">
              <h3 className="product-title">
                {linkPath ? <Link to={linkPath} onClick={(event) => event.stopPropagation()}>{listing.title}</Link> : listing.title}
              </h3>
              <p className="product-price">{formatMinorUnits(toMinorUnits(listing.price))}</p>
              {!isEditable && !allowAddToCart && listing.sellerName && (
                <p className="product-meta">Sold by {listing.sellerName}</p>
              )}
              {(isEditable || allowAddToCart) && listing.description && (
                <p className="product-description">{listing.description}</p>
              )}
              {isEditable && <p className="product-meta">{listing.category}</p>}
              {(isEditable || allowAddToCart) && (
                <p className={isLowStock ? "product-meta product-meta-warning" : "product-meta"}>
                  {isEditable ? `Stock: ${listing.stockQuantity}` : stock.label}
                </p>
              )}
            </div>
          </div>
          {isEditable && isArchived && (
            <div className="product-actions">
              <button type="button" className="btn btn-primary" onClick={() => handleRestore!(listing.id)}>Restore to sale</button>
            </div>
          )}
          {isEditable && !isArchived && (
            <div className="product-actions">
              <button type="button" onClick={() => handleEditClick!(listing)}>Edit Listing</button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete!(listing.id)}>Delete Listing</button>
            </div>
          )}
          {showCartControls && (
            <div className="product-actions">
              {!isSoldOut && (
                <select
                  aria-label={`Quantity for ${listing.title}`}
                  value={selectedQuantity}
                  onChange={(event) => setQuantity(Number(event.currentTarget.value))}
                >
                  {Array.from({ length: listing.stockQuantity }, (_, index) => index + 1).map((option) => (
                    <option key={option} value={option}>Quantity: {option}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className={isSoldOut ? undefined : "btn btn-primary"}
                onClick={handleAddToCart}
                disabled={isAddingToCart || isSoldOut}
              >
                {isSoldOut ? "Sold out" : isAddingToCart ? "Adding..." : "Add to cart"}
              </button>
              {cartFeedback && (
                <p role="status" className={`alert alert-${cartFeedback.kind === "success" ? "success" : cartFeedback.kind === "error" ? "error" : "info"}`}>
                  {cartFeedback.text}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ListingCard;
