import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type {FormData, Listing} from "../pages/DiscoveryPage"
import { CATEGORIES } from "../data/categories"

type ListingCardProps = {
  listing: Listing
  isEditable: boolean
  userRole?: "CONSUMER" | "SELLER" | null
  editingId?: number | null
  editFormData?: FormData
  setEditFormData?: (data: FormData) => void
  setEditImageFile?: (file: File | null) => void
  handleEditClick?: (listing: Listing) => void
  handleDelete?: (id: number) => void
  handleSave?: (id: number) => void
  handleCancel?: () => void
}

function ListingCard({ listing, userRole, editingId, editFormData, setEditFormData, setEditImageFile, handleEditClick, handleDelete, handleSave, handleCancel, isEditable}: ListingCardProps) {
  const navigate = useNavigate()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [cartFeedback, setCartFeedback] = useState("")
  const [quantity, setQuantity] = useState(1)
  const selectedQuantity = Math.min(quantity, listing.stockQuantity)

  function handleCardClick(){
    if(!isEditable && listing.sellerSlug){
      navigate(`/shop/${listing.sellerSlug}`)
    }
  }

  async function handleAddToCart() {
    if (listing.stockQuantity === 0) {
      return
    }

    setIsAddingToCart(true)
    setCartFeedback("")

    try {
      const response = await fetch("http://localhost:3000/cart/items", {
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
          {isEditable && <button onClick={() => handleSave!(listing.id)}>Save</button>}
          {isEditable && <button onClick={handleCancel}>Cancel</button>}
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
            style={!isEditable && listing.sellerSlug ? { cursor: "pointer" } : undefined}
          >
            {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} width="200" />}
            <div>{listing.title}</div>
            <p>Price: {listing.price}</p>
            <div>{listing.description}</div>
            <div>{listing.category}</div>
            <p>Available stock: {listing.stockQuantity}</p>
          </div>
          {isEditable && <button onClick={() => handleEditClick!(listing)}>Edit Listing</button>}
          {isEditable && <button onClick={() => handleDelete!(listing.id)}>Delete Listing</button>}
          {!isEditable && userRole === "CONSUMER" && (
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