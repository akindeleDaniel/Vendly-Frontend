import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

type CartItem = {
  listingId: number
  quantity: number
  listing: {
    id: number
    title: string
    description: string
    price: number
    stockQuantity: number
    category: string
    imageUrl: string | null
    user: {
      sellerProfile: {
        businessName: string
        slug: string
      }
    }
  }
}

type CartResponse = {
  cart: {
    cartItems: CartItem[]
  }
}

function CartPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedQuantities, setSelectedQuantities] = useState<Record<number, number>>({})
  const [updatingListingId, setUpdatingListingId] = useState<number | null>(null)
  const [quantityFeedback, setQuantityFeedback] = useState<Record<number, string>>({})
  const [removingListingId, setRemovingListingId] = useState<number | null>(null)
  const [removeFeedback, setRemoveFeedback] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchCart() {
      try {
        const response = await fetch("http://localhost:3000/cart", {
          credentials: "include",
          signal: controller.signal
        })

        if (response.status === 401) {
          navigate("/login")
          return
        }

        if (!response.ok) {
          throw new Error(`Cart request failed with status ${response.status}`)
        }

        const data: CartResponse = await response.json()
        if (!controller.signal.aborted) {
          setCartItems(data.cart.cartItems)
          setSelectedQuantities(
            Object.fromEntries(
              data.cart.cartItems.map((item) => [
                item.listingId,
                Math.min(item.quantity, item.listing.stockQuantity)
              ])
            )
          )
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error("Unable to load cart:", fetchError)
          setError("Unable to load your cart. Please try again.")
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchCart()
    return () => controller.abort()
  }, [navigate])

  async function updateQuantity(item: CartItem) {
    const quantity = selectedQuantities[item.listingId]
    if (
      updatingListingId !== null ||
      removingListingId !== null ||
      item.listing.stockQuantity === 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > item.listing.stockQuantity ||
      quantity === item.quantity
    ) {
      return
    }

    setUpdatingListingId(item.listingId)
    setQuantityFeedback((feedback) => ({ ...feedback, [item.listingId]: "" }))

    try {
      const response = await fetch(
        `http://localhost:3000/cart/items/${encodeURIComponent(String(item.listingId))}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ quantity })
        }
      )

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
              ? "The requested quantity is no longer available."
              : `Unable to update quantity (status ${response.status}).`
        setQuantityFeedback((feedback) => ({ ...feedback, [item.listingId]: message }))
        return
      }

      setCartItems((items) =>
        items.map((cartItem) =>
          cartItem.listingId === item.listingId ? { ...cartItem, quantity } : cartItem
        )
      )
      setQuantityFeedback((feedback) => ({ ...feedback, [item.listingId]: "Quantity updated." }))
    } catch (updateError) {
      console.error("Unable to update cart item quantity:", updateError)
      setQuantityFeedback((feedback) => ({
        ...feedback,
        [item.listingId]: "Unable to update quantity. Please check your connection and try again."
      }))
    } finally {
      setUpdatingListingId(null)
    }
  }

  async function removeItem(item: CartItem) {
    if (updatingListingId !== null || removingListingId !== null) {
      return
    }

    setRemovingListingId(item.listingId)
    setRemoveFeedback((feedback) => ({ ...feedback, [item.listingId]: "" }))

    try {
      const response = await fetch(
        `http://localhost:3000/cart/items/${encodeURIComponent(String(item.listingId))}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      )

      if (response.status === 401) {
        navigate("/login")
        return
      }

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null)
        const message =
          typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
            ? data.message
            : `Unable to remove this item (status ${response.status}).`
        setRemoveFeedback((feedback) => ({ ...feedback, [item.listingId]: message }))
        return
      }

      setCartItems((items) => items.filter((cartItem) => cartItem.listingId !== item.listingId))
      setSelectedQuantities((quantities) => {
        const remainingQuantities = { ...quantities }
        delete remainingQuantities[item.listingId]
        return remainingQuantities
      })
      setQuantityFeedback((feedback) => {
        const remainingFeedback = { ...feedback }
        delete remainingFeedback[item.listingId]
        return remainingFeedback
      })
      setRemoveFeedback((feedback) => {
        const remainingFeedback = { ...feedback }
        delete remainingFeedback[item.listingId]
        return remainingFeedback
      })
    } catch (removeError) {
      console.error("Unable to remove cart item:", removeError)
      setRemoveFeedback((feedback) => ({
        ...feedback,
        [item.listingId]: "Unable to remove this item. Please check your connection and try again."
      }))
    } finally {
      setRemovingListingId(null)
    }
  }

  if (isLoading) {
    return <p>Loading cart...</p>
  }

  if (error) {
    return <p role="alert">{error}</p>
  }

  if (cartItems.length === 0) {
    return (
      <main>
        <h1>Your Cart</h1>
        <p>Your cart is empty.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Your Cart</h1>
      {cartItems.map((item) => (
        <article key={item.listingId}>
          {item.listing.imageUrl && (
            <img
              src={item.listing.imageUrl}
              alt={item.listing.title}
              width="200"
            />
          )}
          <h2>{item.listing.title}</h2>
          <p>Seller: {item.listing.user.sellerProfile.businessName}</p>
          <p>Price: {item.listing.price}</p>
          <p>Available stock: {item.listing.stockQuantity}</p>
          {item.listing.stockQuantity > 0 ? (
            <>
              <label>
                Quantity:
                <select
                  value={selectedQuantities[item.listingId]}
                  disabled={updatingListingId !== null || removingListingId !== null}
                  onChange={(event) => {
                    const newQuantity = Number(event.currentTarget.value)
                    setSelectedQuantities((quantities) => ({
                      ...quantities,
                      [item.listingId]: newQuantity
                    }))
                  }}
                >
                  {Array.from({ length: item.listing.stockQuantity }, (_, index) => index + 1).map((quantity) => (
                    <option key={quantity} value={quantity}>{quantity}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => updateQuantity(item)}
                disabled={
                  updatingListingId !== null ||
                  removingListingId !== null ||
                  selectedQuantities[item.listingId] === item.quantity
                }
              >
                {updatingListingId === item.listingId ? "Updating..." : "Update quantity"}
              </button>
            </>
          ) : (
            <p>This listing is sold out.</p>
          )}
          {quantityFeedback[item.listingId] && (
            <p role={quantityFeedback[item.listingId] === "Quantity updated." ? "status" : "alert"}>
              {quantityFeedback[item.listingId]}
            </p>
          )}
          <button
            type="button"
            onClick={() => removeItem(item)}
            disabled={updatingListingId !== null || removingListingId !== null}
          >
            {removingListingId === item.listingId ? "Removing..." : "Remove item"}
          </button>
          {removeFeedback[item.listingId] && (
            <p role="alert">{removeFeedback[item.listingId]}</p>
          )}
        </article>
      ))}
    </main>
  )
}

export default CartPage
