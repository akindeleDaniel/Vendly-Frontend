import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import type { Listing, ListingFormData } from "../types/listing"
import type { UserRole } from "../types/user"
import { apiFetch } from "../lib/api"
import { savePendingCartItem } from "../lib/pendingCartItem"
import { CATEGORIES } from "../data/categories"

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

function ListingCard({ listing, userRole, editingId, editFormData, hasChanges, isSaving, saveError, setEditFormData, setEditImageFile, handleEditClick, handleDelete, handleSave, handleCancel, shopLinkSearch, allowAddToCart, isLoggedOut, isEditable}: ListingCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [cartFeedback, setCartFeedback] = useState("")
  const [quantity, setQuantity] = useState(1)
  const selectedQuantity = Math.min(quantity, listing.stockQuantity)

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
      setCartFeedback("We are still checking your session. Please try again in a moment.")
      return
    }

    setIsAddingToCart(true)
    setCartFeedback("")

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
        window.alert(message)
        return
      }

      setCartFeedback("Added to cart.")
    } catch {
      window.alert("Unable to add this listing to your cart. Please check your connection and try again.")
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <div>
      {listing.id === editingId ? (
        <>
          {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} width="200" />}
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
          <label>
            Change photo (optional)
            <input type="file" accept="image/*"
              onChange={(e) => setEditImageFile!(e.target.files?.[0] || null)}
            />
          </label>
          {saveError && <p role="alert">{saveError}</p>}
          {isEditable && <button onClick={() => handleSave!(listing.id)} disabled={!hasChanges || isSaving}>{isSaving ? "Saving..." : "Save"}</button>}
          {isEditable && <button onClick={handleCancel} disabled={isSaving}>Cancel</button>}
        </>
      ) : (
        <>
        {/*
            cursor: pointer here is just a visual hint to the user that this
            card can be clicked, since there's no visible link text anymore.
            This inline style is temporary — once real CSS/styling is set up
            for this project, this should move into a proper class instead
            of living directly on the element like this.
          */}
          <div
            onClick={handleCardClick}
            style={shopPath ? { cursor: "pointer" } : undefined}
          >
            {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} width="200" />}
            <div>{shopPath ? <Link to={shopPath} onClick={(event) => event.stopPropagation()}>{listing.title}</Link> : listing.title}</div>
            <p>Price: {listing.price}</p>
            <div>{listing.description}</div>
            <div>{listing.category}</div>
            <p>Available stock: {listing.stockQuantity}</p>
          </div>
          {isEditable && <button onClick={() => handleEditClick!(listing)}>Edit Listing</button>}
          {isEditable && <button onClick={() => handleDelete!(listing.id)}>Delete Listing</button>}
          {!isEditable && allowAddToCart && userRole !== "SELLER" && (
            <>
              {listing.stockQuantity > 0 ? (
                <>
                  <label>
                    Quantity:
                    <select
                      value={selectedQuantity}
                      onChange={(event) => setQuantity(Number(event.currentTarget.value))}
                    >
                      {Array.from({ length: listing.stockQuantity }, (_, index) => index + 1).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <p>Sold out</p>
              )}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAddingToCart || listing.stockQuantity === 0}
              >
                {isAddingToCart ? "Adding..." : "Add to Cart"}
              </button>
              {cartFeedback && <p role="status">{cartFeedback}</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default ListingCard;