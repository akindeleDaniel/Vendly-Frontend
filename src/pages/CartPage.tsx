import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { apiFetch, getErrorMessage } from "../lib/api"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import Notice from "../components/Notice"
import { useDocumentTitle } from "../lib/useDocumentTitle"

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
  useDocumentTitle("Your cart")
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
      <div>
        <h1>Your cart</h1>
        <Notice kind="error">
          <p>Unable to load your cart. Please check your connection and try again.</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
        </Notice>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div>
        <h1>Your cart</h1>
        {notice && <Notice kind={notice.isError ? "error" : "success"}>{notice.text}</Notice>}
        <p>Your cart is empty.</p>
        <Link to="/" className="btn btn-primary">Keep browsing</Link>
      </div>
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
    <div>
      <h1>Your cart</h1>
      {notice && <Notice kind={notice.isError ? "error" : "success"}>{notice.text}</Notice>}

      <div className="cart-layout">
        <ul className="cart-items">
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
              <li key={item.listingId}>
                <article className="card cart-item">
                  <div className="cart-item-main">
                    {item.listing.imageUrl
                      ? <img className="cart-item-photo" src={item.listing.imageUrl} alt={item.listing.title} loading="lazy" />
                      : <span className="cart-item-photo" role="img" aria-label="No photo available">Photo</span>}
                    <div className="cart-item-info">
                      <h2 className="cart-item-title">{item.listing.title}</h2>
                      <p className="cart-item-meta">
                        Seller: {sellerProfile
                          ? <Link to={`/shop/${encodeURIComponent(sellerProfile.slug)}`}>{sellerProfile.businessName}</Link>
                          : "Unknown seller"}
                      </p>
                      <p className="cart-item-meta">Price: {formatMinorUnits(toMinorUnits(item.listing.price))}</p>
                      <p className="cart-item-meta">Available now: {item.availableQuantity}</p>
                    </div>
                  </div>

                  {noneAvailable && (
                    <Notice kind="error">
                      None of this item is available right now. It may be sold out or held by other shoppers.
                      You can remove it from your cart, or keep it and check back later.
                    </Notice>
                  )}
                  {exceedsAvailable && (
                    <Notice kind="warning">
                      Stock for this item has been reduced. You have {item.quantity} in your cart but only{" "}
                      {item.availableQuantity} {item.availableQuantity === 1 ? "is" : "are"} available now.
                      Choose {item.availableQuantity} or fewer, or remove the item.
                    </Notice>
                  )}

                  <div className="cart-item-controls">
                    {noneAvailable ? (
                      <p className="cart-item-qty-text">Quantity in your cart: {item.quantity}</p>
                    ) : (
                      <label>
                        Quantity
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
                    )}
                    <div className="cart-line">
                      <span className="line-amount">{formatMinorUnits(toMinorUnits(item.listing.price) * item.quantity)}</span>
                      <span className="line-caption">Line subtotal</span>
                    </div>
                  </div>

                  {isUpdating && <p role="status" className="cart-item-meta">Updating...</p>}
                  {message && (
                    <Notice kind={message.isError ? "error" : "success"}>{message.text}</Notice>
                  )}

                  <div className="cart-item-footer">
                    <button
                      type="button"
                      className={noneAvailable ? "btn btn-danger" : "btn-link-danger"}
                      onClick={() => removeItem(item)}
                      disabled={isBusy}
                    >
                      {isRemoving ? "Removing..." : "Remove item"}
                    </button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>

        <div className="cart-aside">
          <section aria-labelledby="cart-summary-heading" className="card cart-summary">
            <h2 id="cart-summary-heading">Cart summary</h2>
            <div className="summary-row"><span>Items</span><span>{cartItems.length}</span></div>
            <div className="summary-row"><span>Total units</span><span>{totalUnits}</span></div>
            <hr className="summary-divider" />
            <div className="summary-row summary-row-total">
              <span>Estimated subtotal<small>excludes shipping</small></span>
              <span className="summary-total-amount">{formatMinorUnits(estimatedSubtotal)}</span>
            </div>
            <p className="summary-note">
              This is an estimate only. Shipping and the final total are not included.
              {hasUnavailableItems && " It also includes items that are not fully available right now."}
            </p>
            {/* The server decides at checkout whether the items can be bought, so the link is always offered. */}
            <Link to="/checkout" className="btn btn-primary btn-lg btn-block">Proceed to checkout</Link>
          </section>

          <button
            type="button"
            className="btn-quiet"
            onClick={clearCart}
            disabled={isBusy}
          >
            {isClearing ? "Clearing..." : "Clear cart"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CartPage
