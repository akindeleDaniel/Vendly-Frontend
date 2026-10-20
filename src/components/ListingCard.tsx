import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import type { Listing, ListingFormData } from "../types/listing"
import type { UserRole } from "../types/user"
import { apiFetch } from "../lib/api"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { savePendingCartItem } from "../lib/pendingCartItem"
import { CATEGORIES } from "../data/categories"
import ImagePicker from "./ImagePicker"

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
  setEditImageFile?: (file: File | null) => void
  handleEditClick?: (listing: Listing) => void
  handleDelete?: (id: number) => void
  handleSave?: (id: number) => void
  handleCancel?: () => void
  shopLinkSearch?: string // query string kept on the shop link so the shop page can return to the same search
  allowAddToCart?: boolean // only storefronts offer Add to Cart; browsing pages just link to the storefront
  isLoggedOut?: boolean // true only once the session check has confirmed the visitor is not logged in
}

type CartFeedback = {
  text: string
  kind: "success" | "error" | "info"
}

// How long the message under Add to cart stays before it goes away. Errors stay longer because
// they take longer to read.
const FEEDBACK_DURATION_MS: Record<CartFeedback["kind"], number> = {
  success: 3000,
  info: 5000,
  error: 8000
}

// At or below this many in stock, the card says "Only N left".
const LOW_STOCK_THRESHOLD = 3

function ListingCard({ listing, userRole, editingId, editFormData, hasChanges, isSaving, saveError, setEditFormData, setEditImageFile, handleEditClick, handleDelete, handleSave, handleCancel, shopLinkSearch, allowAddToCart, isLoggedOut, isEditable}: ListingCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [cartFeedback, setCartFeedback] = useState<CartFeedback | null>(null)
  const [quantity, setQuantity] = useState(1)
  const selectedQuantity = Math.min(quantity, listing.stockQuantity)
  const isSoldOut = listing.stockQuantity === 0
  const isLowStock = !isSoldOut && listing.stockQuantity <= LOW_STOCK_THRESHOLD

  // The message clears itself. Each new message is a new object, so repeating the same one
  // (adding twice) restarts the timer.
  useEffect(() => {
    if (cartFeedback === null) {
      return
    }

    const timer = window.setTimeout(() => setCartFeedback(null), FEEDBACK_DURATION_MS[cartFeedback.kind])
    return () => window.clearTimeout(timer)
  }, [cartFeedback])

  const showCartControls = !isEditable && allowAddToCart && userRole !== "SELLER"

  const shopPath = !isEditable && listing.sellerSlug
    ? `/shop/${encodeURIComponent(listing.sellerSlug)}${shopLinkSearch ? `?${shopLinkSearch}` : ""}`
    : null

  function handleCardClick(){
    if(shopPath){
      navigate(shopPath)
    }
  }

  async function handleAddToCart() {
    if (listing.stockQuantity === 0) {
      return
    }

    // Browsing is open to everyone. A visitor who is not logged in is sent to log in or register;
    // the chosen product is remembered, and the storefront adds it once they are back.
    if (isLoggedOut) {
      savePendingCartItem({
        listingId: listing.id,
        quantity: selectedQuantity,
        returnTo: `${location.pathname}${location.search}`
      })
      navigate("/login")
      return
    }

    // The session is still being checked (or the check failed), so the visitor may well be logged in.
    if (userRole === null || userRole === undefined) {
      setCartFeedback({ text: "We are still checking your session. Please try again in a moment.", kind: "info" })
      return
    }

    setIsAddingToCart(true)
    setCartFeedback(null)

    try {
      const response = await apiFetch("/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          listingId: listing.id,
          quantity: selectedQuantity
        })
      })

      if (response.status === 401) {
        navigate("/login")
        return
      }

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null)
        const message =
          typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
            ? data.message
            : response.status === 409
              ? "This listing is sold out or does not have enough stock."
              : `Unable to add this listing to your cart (status ${response.status}).`
        setCartFeedback({ text: message, kind: "error" })
        return
      }

      setCartFeedback({ text: "Added to cart.", kind: "success" })
    } catch {
      setCartFeedback({
        text: "Unable to add this listing to your cart. Please check your connection and try again.",
        kind: "error"
      })
    } finally {
      setIsAddingToCart(false)
    }
  }

  const isEditing = listing.id === editingId

  return (
    <div className={`product-card${isEditing ? " product-card-editing" : ""}`}>
      {isEditing ? (
        <>
          {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} />}
          <label>
            Title
            <input name="title" value={editFormData!.title}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Description
            <input name="description" value={editFormData!.description}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Price
            <input name="price" value={editFormData!.price}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Stock Quantity
            <input type="number" min="0" step="1" required name="stockQuantity"
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
          <ImagePicker
            label="Change photo (optional)"
            onChange={(file) => setEditImageFile!(file)}
            disabled={isSaving}
          />
          {saveError && <p role="alert" className="alert alert-error">{saveError}</p>}
          {isEditable && <button type="button" className="btn btn-primary" onClick={() => handleSave!(listing.id)} disabled={!hasChanges || isSaving}>{isSaving ? "Saving..." : "Save"}</button>}
          {isEditable && <button type="button" onClick={handleCancel} disabled={isSaving}>Cancel</button>}
        </>
      ) : (
        <>
          {/* The whole card opens the shop (pointer cursor); the title is a real link so keyboard users can too. */}
          <div
            className={`product-link-area${shopPath ? " is-clickable" : ""}`}
            onClick={handleCardClick}
          >
            <div className="product-media">
              {listing.imageUrl
                ? <img src={listing.imageUrl} alt={listing.title} loading="lazy" />
                : <span role="img" aria-label="No photo available">No photo</span>}
              {isSoldOut && <span className="badge badge-amber product-badge">Sold out</span>}
            </div>
            <div className="product-body">
              <h3 className="product-title">
                {shopPath ? <Link to={shopPath} onClick={(event) => event.stopPropagation()}>{listing.title}</Link> : listing.title}
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
                  {isEditable
                    ? `Stock: ${listing.stockQuantity}`
                    : isSoldOut
                      ? "Not available right now"
                      : isLowStock
                        ? `Only ${listing.stockQuantity} left`
                        : `${listing.stockQuantity} available`}
                </p>
              )}
            </div>
          </div>
          {isEditable && (
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
                  onChange={(event) => {
                    setQuantity(Number(event.currentTarget.value))
                    setCartFeedback(null)// a message about the old quantity no longer applies
                  }}
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
