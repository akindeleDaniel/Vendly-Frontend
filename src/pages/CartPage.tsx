import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertTriangle, ArrowLeft, ArrowRight, ShieldCheck, ShoppingBag, Trash2, XCircle } from "lucide-react"
import { apiFetch, getErrorMessage } from "../lib/api"
import { formatMinorUnits, formatNaira, toMinorUnits } from "../lib/money"
import { ORDER_MAX_VALUE } from "../lib/limits"
import Notice from "../components/Notice"
import ShopAvatar from "../components/ShopAvatar"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { CartItem, CartResponse, CartShop } from "../types/cart"

type LoadStatus = "loading" | "ready" | "error"
type LoadResult = "ok" | "unauthorized" | "failed"
type PendingAction = { listingId: number, type: "updating" | "removing" }
type Message = { text: string, isError: boolean }

// A shop's order in the cart: its items, and what they come to without delivery.
type ShopGroup = { key: string, shop: CartShop | null, items: CartItem[], subtotal: number }

const LIMIT_UNITS = toMinorUnits(Number(ORDER_MAX_VALUE))
const NEAR_LIMIT = 0.7// from 70% of the limit, the shop's card shows how much room is left

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

// "Two-piece ankara set (Pink check, M)". An option's own title already holds the choice, so the
// product's plain name and the labels are used when the server sends them.
function itemName(item: CartItem): string {
  const { listing } = item
  const choice = [listing.optionLabel, listing.sizeLabel].filter(Boolean).join(", ")
  return listing.productTitle && choice ? `${listing.productTitle} (${choice})` : listing.productTitle ?? listing.title
}

// A sold-out item is not counted: it cannot be bought until it is removed.
function lineUnits(item: CartItem): number {
  return item.availableQuantity === 0 ? 0 : toMinorUnits(item.listing.price) * item.quantity
}

function groupByShop(items: CartItem[]): ShopGroup[] {
  const groups = new Map<string, ShopGroup>()

  for (const item of items) {
    const shop = item.listing.user.sellerProfile
    const key = shop?.slug ?? "unknown"
    const group = groups.get(key) ?? { key, shop, items: [], subtotal: 0 }
    group.items.push(item)
    group.subtotal += lineUnits(item)
    groups.set(key, group)
  }

  return [...groups.values()]
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
  const [confirmingClear, setConfirmingClear] = useState(false)
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
        setNotice({ text: `"${itemName(item)}" was already removed from your cart.`, isError: false })
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
      setNotice({ text: `Removed "${itemName(item)}" from your cart.`, isError: false })
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
      setConfirmingClear(false)
    }
  }

  if (loadStatus === "loading") {
    return (
      <div className="cart-page" aria-busy="true">
        <p role="status" className="visually-hidden">Loading your cart...</p>
        <div className="skeleton cart-loading-title" />
        <div className="cart-grid">
          <div className="skeleton cart-loading-card" />
          <div className="skeleton cart-loading-card" />
        </div>
      </div>
    )
  }

  if (loadStatus === "error") {
    return (
      <div className="cart-page">
        <h1>Your cart</h1>
        <Notice kind="error">
          <p>Unable to load your cart. Please check your connection and try again.</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
        </Notice>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        {notice && <Notice kind={notice.isError ? "error" : "success"}>{notice.text}</Notice>}
        <section className="cart-empty" aria-labelledby="cart-empty-heading">
          <span className="cart-empty-icon" aria-hidden="true"><ShoppingBag size={32} /></span>
          <h1 id="cart-empty-heading">Your cart is empty</h1>
          <p>Find something you like in a shop and add it here. Your cart is saved, so it is still here next time.</p>
          <Link to="/" className="btn btn-primary btn-lg btn-block">Browse StoreHatch</Link>
          <Link to="/orders" className="cart-empty-link">See my orders</Link>
        </section>
      </div>
    )
  }

  // Display-only arithmetic in whole minor units. The server does not return a cart total.
  const groups = groupByShop(cartItems)
  const subtotal = groups.reduce((sum, group) => sum + group.subtotal, 0)
  const units = cartItems.filter((item) => item.availableQuantity > 0).reduce((sum, item) => sum + item.quantity, 0)
  const overLimit = groups.filter((group) => group.subtotal > LIMIT_UNITS)
  const hasStockProblem = cartItems.some((item) => item.quantity > item.availableQuantity)
  // Checkout refuses these, so they are fixed here first.
  const blockedReason = overLimit.length > 0
    ? `${overLimit[0].shop?.businessName ?? "One shop"} is over the ${formatNaira(ORDER_MAX_VALUE)} limit for one shop. Change it above to check out.`
    : hasStockProblem ? "Some items have less stock than you chose. Change or remove them above to check out." : ""
  const totalText = formatMinorUnits(subtotal)

  const checkoutButton = (label: string) => blockedReason
    ? <button type="button" className="btn btn-lg btn-block cart-checkout" disabled>{label}</button>
    : (
      <Link to="/checkout" className="btn btn-primary btn-lg btn-block cart-checkout">
        {label}<ArrowRight aria-hidden="true" size={18} />
      </Link>
    )

  return (
    <div className="cart-page has-bar">
      <div className="cart-head">
        <div>
          <h1>Your cart</h1>
          <p>{units} {units === 1 ? "item" : "items"} from {groups.length} {groups.length === 1 ? "shop" : "shops"}</p>
        </div>
        <Link to="/" className="cart-back"><ArrowLeft aria-hidden="true" size={18} />Keep shopping</Link>
      </div>
      {notice && <Notice kind={notice.isError ? "error" : "success"}>{notice.text}</Notice>}

      <div className="cart-grid">
        <div className="cart-shops">
          {groups.map((group) => {
            const shopPath = group.shop ? `/shop/${encodeURIComponent(group.shop.slug)}` : null
            const isOver = group.subtotal > LIMIT_UNITS
            const isNear = group.subtotal >= LIMIT_UNITS * NEAR_LIMIT
            const headingId = `cart-shop-${group.key}`

            return (
              <section key={group.key} className="cart-shop" aria-labelledby={headingId}>
                <div className="cart-shop-head">
                  <div className="cart-shop-name">
                    <ShopAvatar name={group.shop?.businessName} logoUrl={group.shop?.logoUrl} brandColor={group.shop?.brandColor} />
                    <div>
                      <h2 id={headingId}>{group.shop?.businessName ?? "Unknown shop"}</h2>
                      {group.shop?.location && <p>{group.shop.location}</p>}
                    </div>
                  </div>
                  {shopPath && <Link to={shopPath} className="cart-shop-link">Visit shop</Link>}
                </div>

                <ul className="cart-entries">
                  {group.items.map((item) => {
                    const name = itemName(item)
                    const isUpdating = pendingAction?.listingId === item.listingId && pendingAction.type === "updating"
                    const isRemoving = pendingAction?.listingId === item.listingId && pendingAction.type === "removing"
                    const message = itemMessages[item.listingId]
                    const soldOut = item.availableQuantity === 0
                    const tooMany = !soldOut && item.quantity > item.availableQuantity
                    const productPath = `/product/${item.listingId}`

                    return (
                      <li key={item.listingId} className="cart-entry">
                        <Link to={productPath} className="cart-entry-photo" tabIndex={-1} aria-hidden="true">
                          {item.listing.imageUrl ? <img src={item.listing.imageUrl} alt="" loading="lazy" /> : <span>No photo</span>}
                        </Link>
                        <div className="cart-entry-info">
                          <h3><Link to={productPath}>{name}</Link></h3>
                          <p className="cart-entry-each">{formatMinorUnits(toMinorUnits(item.listing.price))} each</p>

                          {!soldOut && (
                            <div className="cart-entry-controls">
                              <div className="qty-stepper is-small" role="group" aria-label={`Quantity of ${name}`}>
                                <button type="button" aria-label="One fewer" disabled={isBusy || item.quantity <= 1} onClick={() => updateQuantity(item, item.quantity - 1)}>−</button>
                                <output aria-live="polite">{item.quantity}</output>
                                <button type="button" aria-label="One more" disabled={isBusy || item.quantity >= item.availableQuantity} onClick={() => updateQuantity(item, item.quantity + 1)}>+</button>
                              </div>
                              <button type="button" className="cart-remove" disabled={isBusy} onClick={() => removeItem(item)}>
                                <Trash2 aria-hidden="true" size={16} />
                                {isRemoving ? "Removing..." : "Remove"}
                              </button>
                              {isUpdating && <span role="status" className="cart-entry-status">Updating...</span>}
                            </div>
                          )}

                          {tooMany && (
                            <div className="cart-warn is-low" role="status">
                              <AlertTriangle aria-hidden="true" size={18} />
                              <span>Only {item.availableQuantity} left now. You have {item.quantity} in your cart.</span>
                              <button type="button" disabled={isBusy} onClick={() => updateQuantity(item, item.availableQuantity)}>
                                Change to {item.availableQuantity}
                              </button>
                            </div>
                          )}
                          {soldOut && (
                            <div className="cart-warn is-out" role="status">
                              <XCircle aria-hidden="true" size={18} />
                              <span>Sold out right now, or held by other shoppers. Remove it to check out.</span>
                              <button type="button" disabled={isBusy} onClick={() => removeItem(item)}>
                                {isRemoving ? "Removing..." : "Remove it"}
                              </button>
                            </div>
                          )}
                          {message && <p role="alert" className="cart-entry-error">{message.text}</p>}
                        </div>
                        <p className={soldOut ? "cart-entry-total is-out" : "cart-entry-total"}>
                          {formatMinorUnits(toMinorUnits(item.listing.price) * item.quantity)}
                        </p>
                      </li>
                    )
                  })}
                </ul>

                <div className="cart-shop-foot">
                  <p className="cart-shop-subtotal">
                    <span>{group.shop?.businessName ?? "This shop"} order</span>
                    <b>{formatMinorUnits(group.subtotal)}</b>
                  </p>
                  {isNear ? (
                    <>
                      <div className={isOver ? "cart-meter is-over" : "cart-meter"} aria-hidden="true">
                        <span style={{ width: `${Math.min(100, Math.round(group.subtotal / LIMIT_UNITS * 100))}%` }} />
                      </div>
                      <p className={isOver ? "cart-meter-text is-over" : "cart-meter-text"}>
                        {isOver
                          ? `${formatMinorUnits(group.subtotal - LIMIT_UNITS)} over the ${formatNaira(ORDER_MAX_VALUE)} limit for one shop. Lower a quantity or remove something to check out.`
                          : `${formatMinorUnits(LIMIT_UNITS - group.subtotal)} left before this shop's ${formatNaira(ORDER_MAX_VALUE)} limit (delivery included).`}
                      </p>
                    </>
                  ) : (
                    <p className="cart-shop-note">Delivery is added at checkout.</p>
                  )}
                </div>
              </section>
            )
          })}

          <div className="cart-clear">
            {confirmingClear ? (
              <div className="cart-clear-confirm" role="group" aria-label="Clear cart">
                <span>Remove all {cartItems.length} {cartItems.length === 1 ? "item" : "items"} from your cart?</span>
                <button type="button" disabled={isClearing} onClick={clearCart}>{isClearing ? "Clearing..." : "Yes, clear it"}</button>
                <button type="button" className="is-keep" disabled={isClearing} onClick={() => setConfirmingClear(false)}>Keep them</button>
              </div>
            ) : (
              <button type="button" className="cart-remove" disabled={isBusy} onClick={() => setConfirmingClear(true)}>Clear cart</button>
            )}
          </div>
        </div>

        <aside className="cart-sum" aria-labelledby="cart-sum-heading">
          <h2 id="cart-sum-heading">Order summary</h2>
          <p className="cart-sum-row"><span>Items ({units})</span><span>{totalText}</span></p>
          <p className="cart-sum-row"><span>Delivery</span><span className="is-muted">Added at checkout</span></p>
          <p className="cart-sum-row is-total"><b>Total so far</b><b>{totalText}</b></p>
          {blockedReason && <p role="status" className="cart-sum-blocked">{blockedReason}</p>}
          {checkoutButton("Go to checkout")}
          <div className="cart-sum-safe">
            <ShieldCheck aria-hidden="true" size={22} />
            <p>
              <b>Protected purchase.</b> You pay once. Each shop gets its own order and sends its own delivery.
              Up to {formatNaira(ORDER_MAX_VALUE)} per shop, delivery included.
            </p>
          </div>
        </aside>
      </div>

      <div className="cart-bar">
        <div>
          <span>Total so far</span>
          <b>{totalText}</b>
        </div>
        {checkoutButton("Checkout")}
      </div>
    </div>
  )
}

export default CartPage
