import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { apiFetch, getErrorMessage } from "../lib/api"
import { formatMinorUnits, toMinorUnits } from "../lib/money"

type CartItem = {
  listingId: number
  quantity: number
  availableQuantity: number// what the server will currently let this shopper buy (stock minus other shoppers' reservations)
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
      } | null// a listing's owner may not have a store profile
    }
  }
}

type CartResponse = {
  cart: {
    cartItems: CartItem[]
  } | null// null when the user has no cart yet
}

type LoadStatus = "loading" | "ready" | "error"
type LoadResult = "ok" | "unauthorized" | "failed"
type PendingAction = { listingId: number, type: "updating" | "removing" }
type Message = { text: string, isError: boolean }

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const item = value as Partial<CartItem>
  return (
    Number.isInteger(item.listingId) &&
    Number.isInteger(item.quantity) &&
    Number.isInteger(item.availableQuantity) &&
    typeof item.listing === "object" &&
    item.listing !== null &&
    typeof item.listing.price === "number"
  )
}

function CartPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading")
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [itemMessages, setItemMessages] = useState<Record<number, Message>>({})
  const [notice, setNotice] = useState<Message | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const isBusy = pendingAction !== null || isClearing

  const loadCart = useCallback(async (signal?: AbortSignal): Promise<LoadResult> => {
    try {
      const response = await apiFetch("/cart", {
        credentials: "include",
        signal
      })

      if (signal?.aborted) {
        return "failed"
      }

      if (response.status === 401) {
        navigate("/login")
        return "unauthorized"
      }

      if (!response.ok) {
        return "failed"
      }

      const data: CartResponse = await response.json()
      if (signal?.aborted) {
        return "failed"
      }

      setCartItems(data.cart?.cartItems ?? [])// no cart row is the same as an empty cart
      return "ok"
    } catch {
      return "failed"
    }
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()

    async function loadInitialCart() {
      setLoadStatus("loading")
      const result = await loadCart(controller.signal)

      if (controller.signal.aborted || result === "unauthorized") {
        return
      }
      setLoadStatus(result === "ok" ? "ready" : "error")
    }

    loadInitialCart()
    return () => controller.abort()
  }, [loadCart, loadAttempt])

  // Re-reads the cart after a conflict so the screen shows what the server now says.
  async function refreshCart() {
    const result = await loadCart()
    if (result === "failed") {
      setNotice({
        text: "We could not refresh your cart. Reload the page to see the latest availability.",
        isError: true
      })
    }
  }

  function setItemMessage(listingId: number, message: Message | null) {
    setItemMessages((messages) => {
      const remaining = { ...messages }
      if (message) {
        remaining[listingId] = message
      } else {
        delete remaining[listingId]
      }
      return remaining
    })
  }

  async function updateQuantity(item: CartItem, quantity: number) {
    if (
      isBusy ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > item.availableQuantity ||
      quantity === item.quantity
    ) {
      return
    }

    setPendingAction({ listingId: item.listingId, type: "updating" })
    setItemMessage(item.listingId, null)
    setNotice(null)

    try {
      const response = await apiFetch(
        `/cart/items/${encodeURIComponent(String(item.listingId))}`,
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
        const message = await getErrorMessage(response, `Unable to update quantity (status ${response.status}).`)

        if (response.status === 404) {
          setNotice({ text: "That item is no longer in your cart.", isError: true })
          await refreshCart()
        } else {
          setItemMessage(item.listingId, { text: message, isError: true })
          if (response.status === 409) {
            await refreshCart()// availability changed, so show the server's current numbers
          }
        }
        return
      }

      const data: unknown = await response.json().catch(() => null)
      if (isCartItem(data)) {
        // The server's answer, not the requested number, is what is shown from now on.
        setCartItems((items) => items.map((cartItem) => cartItem.listingId === data.listingId ? data : cartItem))
        setItemMessage(item.listingId, { text: "Quantity updated.", isError: false })
      } else {
        await refreshCart()
      }
    } catch {
      setItemMessage(item.listingId, {
        text: "Unable to update quantity. Please check your connection and try again.",
        isError: true
      })
    } finally {
      setPendingAction(null)
    }
  }

  async function removeItem(item: CartItem) {
    if (isBusy) {
      return
    }

    setPendingAction({ listingId: item.listingId, type: "removing" })
    setItemMessage(item.listingId, null)
    setNotice(null)

    try {
      const response = await apiFetch(
        `/cart/items/${encodeURIComponent(String(item.listingId))}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      )

      if (response.status === 401) {
        navigate("/login")
        return
      }

      if (response.status === 404) {
        setNotice({ text: `"${item.listing.title}" was already removed from your cart.`, isError: false })
        await refreshCart()
        return
      }

      if (!response.ok) {
        const message = await getErrorMessage(response, `Unable to remove this item (status ${response.status}).`)
        setItemMessage(item.listingId, { text: message, isError: true })
        return
      }

      setCartItems((items) => items.filter((cartItem) => cartItem.listingId !== item.listingId))
      setItemMessage(item.listingId, null)
      setNotice({ text: `Removed "${item.listing.title}" from your cart.`, isError: false })
    } catch {
      setItemMessage(item.listingId, {
        text: "Unable to remove this item. Please check your connection and try again.",
        isError: true
      })
    } finally {
      setPendingAction(null)
    }
  }

  async function clearCart() {
    if (cartItems.length === 0 || isBusy) {
      return
    }

    if (!window.confirm("Are you sure you want to clear your cart?")) {
      return
    }

    setIsClearing(true)
    setNotice(null)

    try {
      const response = await apiFetch("/cart", {
        method: "DELETE",
        credentials: "include"
      })

      if (response.status === 401) {
        navigate("/login")
        return
      }

      if (!response.ok) {
        setNotice({
          text: await getErrorMessage(response, `Unable to clear your cart (status ${response.status}).`),
          isError: true
        })
        return
      }

      setCartItems([])
      setItemMessages({})
    } catch {
      setNotice({
        text: "Unable to clear your cart. Please check your connection and try again.",
        isError: true
      })
    } finally {
      setIsClearing(false)
    }
  }

  if (loadStatus === "loading") {
    return <p role="status">Loading cart...</p>
  }

  if (loadStatus === "error") {
    return (
      <main>
        <h1>Your Cart</h1>
        <div role="alert">
          <p>Unable to load your cart. Please check your connection and try again.</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
        </div>
      </main>
    )
  }

  if (cartItems.length === 0) {
    return (
      <main>
        <h1>Your Cart</h1>
        {notice && <p role={notice.isError ? "alert" : "status"}>{notice.text}</p>}
        <p>Your cart is empty.</p>
        <Link to="/">Keep browsing</Link>
      </main>
    )
  }

  // Display-only arithmetic in whole minor units. The server does not return a cart total.
  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const estimatedSubtotal = cartItems.reduce(
    (sum, item) => sum + toMinorUnits(item.listing.price) * item.quantity,
    0
  )
  const hasUnavailableItems = cartItems.some((item) => item.quantity > item.availableQuantity)

  return (
    <main>
      <h1>Your Cart</h1>
      {notice && <p role={notice.isError ? "alert" : "status"}>{notice.text}</p>}

      {cartItems.map((item) => {
        const sellerProfile = item.listing.user.sellerProfile
        const isUpdating = pendingAction?.listingId === item.listingId && pendingAction.type === "updating"
        const isRemoving = pendingAction?.listingId === item.listingId && pendingAction.type === "removing"
        const message = itemMessages[item.listingId]
        const noneAvailable = item.availableQuantity === 0
        const exceedsAvailable = !noneAvailable && item.quantity > item.availableQuantity
        // Choices go up to what is available now. A quantity above that is kept as the current
        // value, so it is shown exactly as the shopper chose it and is never changed for them.
        const quantityOptions = Array.from({ length: item.availableQuantity }, (_, index) => index + 1)

        return (
          <article key={item.listingId}>
            {item.listing.imageUrl && (
              <img
                src={item.listing.imageUrl}
                alt={item.listing.title}
                width="200"
              />
            )}
            <h2>{item.listing.title}</h2>
            <p>
              Seller: {sellerProfile
                ? <Link to={`/shop/${encodeURIComponent(sellerProfile.slug)}`}>{sellerProfile.businessName}</Link>
                : "Unknown seller"}
            </p>
            <p>Price: {formatMinorUnits(toMinorUnits(item.listing.price))}</p>
            <p>Available now: {item.availableQuantity}</p>

            {noneAvailable ? (
              <>
                <p>Quantity in your cart: {item.quantity}</p>
                <p role="alert">
                  None of this item is available right now. It may be sold out or held by other shoppers.
                  You can remove it from your cart, or keep it and check back later.
                </p>
              </>
            ) : (
              <>
                <label>
                  Quantity:
                  <select
                    value={item.quantity}
                    disabled={isBusy}
                    onChange={(event) => updateQuantity(item, Number(event.currentTarget.value))}
                  >
                    {exceedsAvailable && (
                      <option value={item.quantity}>{item.quantity} (more than available)</option>
                    )}
                    {quantityOptions.map((quantity) => (
                      <option key={quantity} value={quantity}>{quantity}</option>
                    ))}
                  </select>
                </label>
                {isUpdating && <span role="status"> Updating...</span>}
                {exceedsAvailable && (
                  <p role="alert">
                    Stock for this item has been reduced. You have {item.quantity} in your cart but only{" "}
                    {item.availableQuantity} {item.availableQuantity === 1 ? "is" : "are"} available now.
                    Choose {item.availableQuantity} or fewer, or remove the item.
                  </p>
                )}
              </>
            )}

            <p>Line subtotal: {formatMinorUnits(toMinorUnits(item.listing.price) * item.quantity)}</p>

            {message && (
              <p role={message.isError ? "alert" : "status"}>{message.text}</p>
            )}
            <button
              type="button"
              onClick={() => removeItem(item)}
              disabled={isBusy}
            >
              {isRemoving ? "Removing..." : "Remove item"}
            </button>
          </article>
        )
      })}

      <section aria-labelledby="cart-summary-heading">
        <h2 id="cart-summary-heading">Cart summary</h2>
        <p>Items: {cartItems.length}</p>
        <p>Total units: {totalUnits}</p>
        <p>Estimated subtotal (excludes shipping): {formatMinorUnits(estimatedSubtotal)}</p>
        <p>
          This is an estimate only. Shipping and the final total are not included.
          {hasUnavailableItems && " It also includes items that are not fully available right now."}
        </p>
      </section>

      <button
        type="button"
        onClick={clearCart}
        disabled={isBusy}
      >
        {isClearing ? "Clearing..." : "Clear Cart"}
      </button>
    </main>
  )
}

export default CartPage
