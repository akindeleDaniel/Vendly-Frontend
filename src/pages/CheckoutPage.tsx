import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, Check, Clock, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"
import DeliveryFields from "../components/DeliveryFields"
import Notice from "../components/Notice"
import PaymentOptions from "../components/PaymentOptions"
import PreOrderCheckoutBlock from "../components/PreOrderCheckoutBlock"
import { fetchCheckoutPreview, submitCheckout, validateDelivery } from "../lib/checkoutApi"
import type { DeliveryUnavailable, OrderTooLarge } from "../lib/checkoutApi"
import { ORDER_MAX_VALUE } from "../lib/limits"
import type { DeliveryValidationError } from "../lib/checkoutApi"
import type { CheckoutResult, CheckoutReview, DeliveryDetails, LockedCheckout } from "../types/checkout"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { formatNaira } from "../lib/money"

type PreviewStatus = "loading" | "ready" | "empty" | "blocked" | "too-large" | "error"

function deliveryUnavailableMessage(outcome: DeliveryUnavailable): string {
  return `${outcome.sellerName ?? "A shop in your cart"} does not deliver to ${outcome.state ?? "that state"}. Remove its items from your cart, or choose another delivery state.`
}

// An order from one shop above the order limit: says what the limit is, what this order comes to, and what to do.
function orderTooLargeMessage(outcome: OrderTooLarge): string {
  const limit = formatNaira(outcome.limit ?? ORDER_MAX_VALUE)
  const shop = outcome.sellerName ?? "one shop"
  const total = outcome.orderTotal ? ` Your order from ${shop} comes to ${formatNaira(outcome.orderTotal)}.` : ""
  return `An order from one shop can be up to ${limit}, delivery included.${total} Remove some items, or split it into smaller orders.`
}

type Issue =
  | { type: "items-unavailable", itemTitle: string | null, message: string }
  | { type: "locked", message: string, checkout: LockedCheckout | null }
  | { type: "conflict", message: string }// a conflict whose follow-up refresh failed, so the order summary is out of date
  | { type: "invalid", message: string }
  | { type: "unconfirmed" }
  | { type: "error", message: string }

// Shown until the shopper explicitly confirms the refreshed review.
type ReviewNotice = {
  message: string
  previousTotal: string | null
}

const REVIEW_CHANGED_MESSAGE =
  "Prices, stock, reservations, shipping or totals may have changed since you last reviewed your order. " +
  "Please check the updated summary below."

const CONFLICT_NOT_CREATED_MESSAGE =
  "Your checkout changed while it was being created, so your new checkout was not created."

const CONFLICT_MESSAGE =
  CONFLICT_NOT_CREATED_MESSAGE + " We refreshed your order summary. Please check the updated summary below."

const NETWORK_ERROR_MESSAGE = "We could not reach the server. Please check your connection and try again."

function findItemTitle(review: CheckoutReview | null, listingId: number | null): string | null {
  if (!review || listingId === null) {
    return null
  }

  for (const group of review.sellers) {
    const item = group.items.find((candidate) => candidate.listingId === listingId)
    if (item) {
      return item.title
    }
  }

  return null
}

function formatTime(isoTime: string): string {
  const date = new Date(isoTime)
  return Number.isNaN(date.getTime()) ? isoTime : date.toLocaleString()
}

// "3:42 PM", with the day when it is not today.
function formatHeldUntil(isoTime: string): string {
  const date = new Date(isoTime)
  if (Number.isNaN(date.getTime())) {
    return isoTime
  }
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return date.toDateString() === new Date().toDateString() ? time : `${time} on ${date.toLocaleDateString()}`
}

function formatStatus(status: string): string {
  if (status === "PENDING") {
    return "Pending"
  }
  if (status === "PENDING_PAYMENT") {
    return "Pending payment"
  }
  return status
}

type Step = "delivery" | "pay"

// Where the shopper is in checkout: delivery details, then payment, then the result page.
function CheckoutSteps({ current }: { current: Step }) {
  const isPay = current === "pay"

  return (
    <ol className="checkout-steps" aria-label="Checkout steps">
      <li className={isPay ? "is-done" : "is-current"} aria-current={isPay ? undefined : "step"}>
        <span className="checkout-step-dot">{isPay ? <Check aria-hidden="true" size={16} /> : "1"}</span>
        Delivery{isPay && <span className="visually-hidden"> (done)</span>}
      </li>
      <li className="checkout-step-bar" aria-hidden="true" />
      <li className={isPay ? "is-current" : undefined} aria-current={isPay ? "step" : undefined}>
        <span className="checkout-step-dot">2</span>Pay
      </li>
      <li className="checkout-step-bar" aria-hidden="true" />
      <li><span className="checkout-step-dot">3</span>Done</li>
    </ol>
  )
}

function feeText(amount: string): string {
  return Number(amount) === 0 ? "Free" : formatNaira(amount)
}

type OrderPanelProps = {
  review: CheckoutReview
  totals?: { subtotal: string, shipping: string, total: string }// the created checkout's own totals, once there is one
  notice?: ReactNode// shown at the top, for example "something changed since you looked"
  onCheckAgain: () => void
  isRefreshing: boolean
  showPreOrders: boolean
  children?: ReactNode// the button and what stops it, under the totals
}

// The order beside the form: each shop's items with small photos, its delivery fee, any pre-order
// step for a food shop, and the totals. Every amount is a string worked out by the server and shown as it is.
function OrderPanel({ review, totals, notice, onCheckAgain, isRefreshing, showPreOrders, children }: OrderPanelProps) {
  const shopCount = review.sellers.length
  const hasState = Boolean(review.deliveryState)
  const subtotal = totals?.subtotal ?? review.subtotal
  const shipping = totals?.shipping ?? review.shipping
  const total = totals?.total ?? review.total

  return (
    <aside className="checkout-card checkout-panel" aria-labelledby="order-panel-heading">
      <h2 id="order-panel-heading" className="checkout-panel-title">Your order</h2>
      <p className="checkout-lead">
        {shopCount === 1 ? "1 shop, so 1 order." : `${shopCount} shops, so ${shopCount} orders. You pay once.`}
      </p>
      {notice}

      {review.sellers.map((group) => (
        <section key={group.seller.slug} className="checkout-shop" aria-label={group.seller.businessName}>
          <p className="checkout-shop-head">
            <Link to={`/shop/${encodeURIComponent(group.seller.slug)}`}>{group.seller.businessName}</Link>
            <Link to="/cart" className="checkout-edit">Edit in cart</Link>
          </p>
          <ul className="checkout-lines">
            {group.items.map((item) => (
              <li key={item.listingId} className="checkout-line">
                <span className="checkout-thumb">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : null}
                  <span className="checkout-qty" aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                </span>
                <span className="checkout-line-name">{item.title}</span>
                <span className="checkout-line-amount">{formatNaira(item.lineSubtotal)}</span>
              </li>
            ))}
          </ul>
          <p className="checkout-row">
            <span className="is-muted">Delivery</span>
            <span>{!hasState && group.shippingVaries ? "Choose your state" : feeText(group.shipping)}</span>
          </p>
          {showPreOrders && <PreOrderCheckoutBlock group={group} onCheckAgain={onCheckAgain} isRefreshing={isRefreshing} />}
        </section>
      ))}

      <div className="checkout-totals">
        <p className="checkout-row"><span className="is-muted">Items</span><span>{formatNaira(subtotal)}</span></p>
        <p className="checkout-row">
          <span className="is-muted">Delivery</span>
          <span>{hasState || totals ? feeText(shipping) : "Choose your state"}</span>
        </p>
        <p className="checkout-row is-total"><b>Total</b><b>{formatNaira(total)}</b></p>
      </div>

      {children}

      <div className="checkout-safe">
        <ShieldCheck aria-hidden="true" size={22} />
        <p><b>Protected purchase.</b> If an order does not arrive or is not as described, raise a complaint from My orders.</p>
      </div>
    </aside>
  )
}

function CheckoutPage() {
  useDocumentTitle("Checkout")
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("loading")
  const [previewMessage, setPreviewMessage] = useState("")
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [review, setReview] = useState<CheckoutReview | null>(null)
  const [reviewNotice, setReviewNotice] = useState<ReviewNotice | null>(null)
  // The name is left blank: the parcel may be for someone other than the account holder.
  const [delivery, setDelivery] = useState<DeliveryDetails>({
    fullName: "",
    phone: "",
    address: "",
    state: "",
    lga: "",
    instructions: ""
  })
  const [validationError, setValidationError] = useState<DeliveryValidationError | null>(null)
  const [issue, setIssue] = useState<Issue | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [preOrderProblem, setPreOrderProblem] = useState("")
  const [stateProblem, setStateProblem] = useState("")// a shop in the cart does not deliver to the chosen state
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const submittingRef = useRef(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  // Food shops that take pre-orders: the approved requests this payment uses, and whether a shop that
  // only takes pre-orders still has to approve one.
  const approvedPreOrderIds = (review?.sellers ?? []).flatMap((group) => group.preOrder?.approved ? [group.preOrder.approved.id] : [])
  const waitingForPreOrder = (review?.sellers ?? []).some((group) => group.preOrder?.required === true && !group.preOrder.approved)
  const isBlocked = issue?.type === "items-unavailable" || issue?.type === "locked" || issue?.type === "conflict"

  useEffect(() => {
    const controller = new AbortController()

    async function loadPreview() {
      setPreviewStatus("loading")
      const outcome = await fetchCheckoutPreview(controller.signal)

      if (controller.signal.aborted) {
        return
      }

      switch (outcome.kind) {
        case "ok":
          setReview(outcome.review)
          setPreviewStatus("ready")
          break
        case "empty-cart":
          setPreviewStatus("empty")
          break
        case "order-too-large":
          setPreviewMessage(orderTooLargeMessage(outcome))
          setPreviewStatus("too-large")
          break
        case "items-unavailable":
          setIssue({ type: "items-unavailable", itemTitle: null, message: outcome.message })
          setPreviewStatus("blocked")
          break
        case "conflict":
          setPreviewMessage("Your checkout state changed while it was loading. Please try again.")
          setPreviewStatus("error")
          break
        case "network-error":
          setPreviewMessage(NETWORK_ERROR_MESSAGE)
          setPreviewStatus("error")
          break
        case "error":
          setPreviewMessage(outcome.message)
          setPreviewStatus("error")
          break
        case "unauthorized":
          break// the session guard sends the shopper to log in
      }
    }

    loadPreview()
    return () => controller.abort()
  }, [loadAttempt])

  // The review notice replaces the submit button, so focus moves to it for keyboard and screen reader users.
  useEffect(() => {
    if (reviewNotice) {
      noticeRef.current?.focus()
    }
  }, [reviewNotice])

  // Delivery fees depend on the buyer's state, so once one is chosen the summary is worked out again for it.
  useEffect(() => {
    if (!delivery.state || previewStatus !== "ready") {
      return
    }

    const controller = new AbortController()
    fetchCheckoutPreview(controller.signal, delivery.state).then((outcome) => {
      if (controller.signal.aborted) {
        return
      }

      if (outcome.kind === "ok") {
        setReview(outcome.review)
        setStateProblem("")
      } else if (outcome.kind === "delivery-unavailable") {
        setStateProblem(deliveryUnavailableMessage(outcome))
      } else if (outcome.kind === "order-too-large") {
        setPreviewMessage(orderTooLargeMessage(outcome))
        setPreviewStatus("too-large")
      }
    })
    return () => controller.abort()
  }, [delivery.state, previewStatus])

  function updateDelivery(next: DeliveryDetails) {
    setDelivery(next)
    setValidationError(null)// the message is about the previous input
  }

  // After a conflict the order summary is out of date, so a failed refresh keeps the shopper from
  // submitting until a check succeeds (and the refreshed summary has been confirmed).
  function refreshFailure(reason: "check-again" | "conflict", message: string): Issue {
    if (reason === "conflict") {
      return {
        type: "conflict",
        message: CONFLICT_NOT_CREATED_MESSAGE + " We could not refresh your order summary yet. " + message + " Please use \"Check again\"."
      }
    }

    return { type: "error", message }
  }

  // Re-reads the preview on the shopper's request (or after a conflict). A review that differs from
  // the one they saw must be confirmed again before anything can be submitted.
  async function refreshPreview(reason: "check-again" | "conflict") {
    setIsRefreshing(true)
    const outcome = await fetchCheckoutPreview(undefined, delivery.state || undefined)
    setIsRefreshing(false)

    switch (outcome.kind) {
      case "ok": {
        const changed = review === null || review.reviewToken !== outcome.review.reviewToken
        setReview(outcome.review)
        setPreviewStatus("ready")
        setIssue(null)
        if (reason === "conflict" || changed) {
          setReviewNotice({
            message: reason === "conflict" ? CONFLICT_MESSAGE : REVIEW_CHANGED_MESSAGE,
            previousTotal: review && review.total !== outcome.review.total ? review.total : null
          })
        }
        break
      }
      case "empty-cart":
        setPreviewStatus("empty")
        break
      case "order-too-large":
        setPreviewMessage(orderTooLargeMessage(outcome))
        setPreviewStatus("too-large")
        break
      case "items-unavailable":
        setIssue({
          type: "items-unavailable",
          itemTitle: findItemTitle(review, outcome.listingId),
          message: outcome.message
        })
        break
      case "conflict":
        setIssue(refreshFailure(reason, "Your checkout state changed while it was loading."))
        break
      case "network-error":
        setIssue(refreshFailure(reason, NETWORK_ERROR_MESSAGE))
        break
      case "error":
        setIssue(refreshFailure(reason, outcome.message))
        break
      case "unauthorized":
        break
    }
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submittingRef.current || isRefreshing || review === null || reviewNotice !== null || isBlocked || waitingForPreOrder || stateProblem) {
      return
    }

    const deliveryError = validateDelivery(delivery)
    if (deliveryError) {
      setValidationError(deliveryError)
      return
    }

    setValidationError(null)
    setIssue(null)
    setPreOrderProblem("")
    submittingRef.current = true// blocks a second submit even before the next render disables the button
    setIsSubmitting(true)

    try {
      const outcome = await submitCheckout(delivery, review.reviewToken, approvedPreOrderIds)

      switch (outcome.kind) {
        case "success":
          setResult(outcome.result)
          break
        case "review-required":
          setReview(outcome.review)
          setReviewNotice({
            message: REVIEW_CHANGED_MESSAGE,
            previousTotal: review.total !== outcome.review.total ? review.total : null
          })
          break
        case "items-unavailable":
          setIssue({
            type: "items-unavailable",
            itemTitle: findItemTitle(review, outcome.listingId),
            message: outcome.message
          })
          break
        case "locked":
          setIssue({ type: "locked", message: outcome.message, checkout: outcome.checkout })
          break
        case "conflict":
          await refreshPreview("conflict")
          break
        case "order-too-large":
          setIssue({ type: "error", message: orderTooLargeMessage(outcome) })
          break
        case "delivery-unavailable":
          setStateProblem(deliveryUnavailableMessage(outcome))
          break
        case "preorder-problem":
          await refreshPreview("check-again")
          setPreOrderProblem(outcome.message)
          break
        case "empty-cart":
          setPreviewStatus("empty")
          break
        case "invalid-request":
          setIssue({ type: "invalid", message: outcome.message })
          break
        case "unconfirmed":
          setIssue({ type: "unconfirmed" })
          break
        case "error":
          setIssue({ type: "error", message: outcome.message })
          break
        case "unauthorized":
          break// the session guard sends the shopper to log in
      }
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  // Step 2: the checkout exists and the items are held; the shopper chooses how to pay.
  if (result) {
    const to = result.checkout.delivery

    return (
      <div className="checkout-page">
        <div className="checkout-top">
          <button type="button" className="back-link" onClick={() => setResult(null)}>
            <ArrowLeft aria-hidden="true" size={18} />
            Back to delivery details
          </button>
          <CheckoutSteps current="pay" />
        </div>

        <div className="checkout-grid">
          <div className="checkout-main">
            <PaymentOptions checkoutId={result.checkout.id} total={result.total}>
              <p className="checkout-held">
                <Clock aria-hidden="true" size={20} />
                <span>
                  <b>Your items are held for you until {formatHeldUntil(result.checkout.expiresAt)}.</b>{" "}
                  Starting payment keeps them held for 30 minutes more. Nothing has been charged yet.
                </span>
              </p>
              {result.code === "CHECKOUT_REUSED" && <p className="checkout-held-extra">You already had a checkout with exactly these items, so it was kept.</p>}
              {result.code === "CHECKOUT_REPLACED" && <p className="checkout-held-extra">This replaces the checkout you started earlier.</p>}
            </PaymentOptions>

            <section className="checkout-card checkout-to" aria-labelledby="deliver-to-heading">
              <div>
                <h2 id="deliver-to-heading">Delivering to</h2>
                <p>{to.fullName} · {to.phone}</p>
                <p>{to.address}, {to.lga}, {to.state}</p>
                {to.instructions && <p className="checkout-small">Note for the rider: {to.instructions}</p>}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setResult(null)}>Change</button>
            </section>
          </div>

          {review && (
            <OrderPanel
              review={review}
              totals={result}
              onCheckAgain={() => refreshPreview("check-again")}
              isRefreshing={isRefreshing}
              showPreOrders={false}
            />
          )}
        </div>
      </div>
    )
  }

  if (previewStatus === "loading") {
    return (
      <div className="checkout-page" aria-busy="true">
        <p role="status" className="visually-hidden">Loading checkout...</p>
        <div className="checkout-grid">
          <div className="skeleton checkout-loading-main" />
          <div className="skeleton checkout-loading-panel" />
        </div>
      </div>
    )
  }

  if (previewStatus === "error" || previewStatus === "too-large" || previewStatus === "empty" || previewStatus === "blocked") {
    return (
      <div className="checkout-page">
        <section className="checkout-card checkout-message" aria-labelledby="checkout-message-heading">
          <h1 id="checkout-message-heading" className="checkout-title is-page">
            {previewStatus === "empty" ? "Your cart is empty" : previewStatus === "too-large" ? "This order is over the limit" : "Checkout cannot start yet"}
          </h1>
          {previewStatus === "error" && (
            <Notice kind="error">
              <p>{previewMessage}</p>
              <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
            </Notice>
          )}
          {previewStatus === "too-large" && <Notice kind="warning">{previewMessage}</Notice>}
          {previewStatus === "empty" && <p>There is nothing to check out. Find something you like and add it to your cart.</p>}
          {previewStatus === "blocked" && (
            <Notice kind="error">
              <p>One or more items in your cart cannot be checked out right now, for example because there is not enough stock. Please review your cart.</p>
              {(issue?.type === "items-unavailable" || issue?.type === "error") && <p>{issue.message}</p>}
            </Notice>
          )}
          <div className="action-row">
            {previewStatus === "empty"
              ? <Link to="/" className="btn btn-primary">Browse StoreHatch</Link>
              : <Link to="/cart" className="btn btn-primary">Back to cart</Link>}
            {previewStatus === "blocked" && (
              <button type="button" onClick={() => refreshPreview("check-again")} disabled={isRefreshing}>
                {isRefreshing ? "Checking..." : "Check again"}
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  if (review === null) {
    return null// not reachable: a ready checkout always has a review
  }

  // Step 1: delivery details. What still stops the shopper is said next to the button.
  const blockedReason = !delivery.state
    ? "Choose your state to see delivery fees."
    : stateProblem ? "One shop does not deliver to your state."
    : reviewNotice ? "Check the new total above to continue."
    : waitingForPreOrder ? "A food shop in your order has to approve a pre-order first."
    : ""

  const panelNotice = (
    <>
      {reviewNotice && (
        <div className="checkout-note is-warning" role="alert" ref={noticeRef} tabIndex={-1}>
          <p><b>Something changed since you looked.</b> {reviewNotice.message}</p>
          {reviewNotice.previousTotal !== null && (
            <p>Your total was {formatNaira(reviewNotice.previousTotal)} and is now {formatNaira(review.total)}.</p>
          )}
          <button type="button" onClick={() => setReviewNotice(null)}>I have checked the new total</button>
        </div>
      )}
      {stateProblem && (
        <div className="checkout-note is-error" role="alert">
          <p>{stateProblem}</p>
          <Link to="/cart">Edit cart</Link>
        </div>
      )}
    </>
  )

  return (
    <div className="checkout-page">
      <div className="checkout-top">
        {!isSubmitting
          ? <Link to="/cart" className="back-link"><ArrowLeft aria-hidden="true" size={18} />Back to cart</Link>
          : <span />}
        <CheckoutSteps current="delivery" />
      </div>

      <div className="checkout-grid">
        <div className="checkout-main">
          <form id="delivery-form" onSubmit={handleSubmit} className="checkout-card checkout-delivery" aria-labelledby="delivery-heading">
            <h1 id="delivery-heading" className="checkout-title is-page">Where should we deliver?</h1>
            <p className="checkout-lead">Pick your state first: each shop's delivery fee depends on it.</p>
            <DeliveryFields
              formData={delivery}
              setFormData={updateDelivery}
              disabled={isSubmitting}
              invalidField={validationError?.field}
              errorId="delivery-error"
            />

            {validationError && <Notice kind="error" id="delivery-error">{validationError.message}</Notice>}

            {issue?.type === "items-unavailable" && (
              <Notice kind="error">
                <p>
                  {issue.itemTitle
                    ? `"${issue.itemTitle}" cannot be checked out right now (for example, it is out of stock or the shop is no longer selling).`
                    : "An item in your cart cannot be checked out right now (for example, it is out of stock or the shop is no longer selling)."}
                  {" "}Your checkout was not created. Please review your cart.
                </p>
                <Link to="/cart" className="btn">Back to cart</Link>
              </Notice>
            )}
            {issue?.type === "locked" && (
              <Notice kind="warning">
                <p>
                  You already have a checkout that cannot be replaced right now, so a new one was not created.
                  {" "}{issue.message}.
                </p>
                {issue.checkout && (
                  <p>
                    Existing checkout {issue.checkout.id}: status {formatStatus(issue.checkout.status)}, expires {formatTime(issue.checkout.expiresAt)}.
                  </p>
                )}
                <p>You can pay for that checkout below (its items as they were when you created it), or try again after it expires.</p>
              </Notice>
            )}
            {issue?.type === "conflict" && <Notice kind="warning">{issue.message}</Notice>}
            {issue?.type === "invalid" && (
              <Notice kind="error">
                The server did not accept your delivery details. Please check each field and try again.
              </Notice>
            )}
            {issue?.type === "unconfirmed" && (
              <Notice kind="warning">
                We could not confirm whether your checkout was created. It may or may not have gone through.
                You can try again with the same details: if it already exists, it will be kept rather than duplicated.
              </Notice>
            )}
            {issue?.type === "error" && <Notice kind="error">{issue.message}</Notice>}
            {preOrderProblem && <Notice kind="warning">{preOrderProblem}</Notice>}
          </form>

          {issue?.type === "locked" && issue.checkout && <PaymentOptions checkoutId={issue.checkout.id} />}
        </div>

        <OrderPanel
          review={review}
          notice={panelNotice}
          onCheckAgain={() => refreshPreview("check-again")}
          isRefreshing={isRefreshing}
          showPreOrders
        >
          {isBlocked ? (
            <button type="button" className="btn btn-primary btn-lg btn-block checkout-go" onClick={() => refreshPreview(issue?.type === "conflict" ? "conflict" : "check-again")} disabled={isRefreshing}>
              {isRefreshing ? "Checking..." : "Check again"}
            </button>
          ) : (
            <>
              {blockedReason && <p role="status" className="checkout-reason">{blockedReason}</p>}
              <button
                type="submit"
                form="delivery-form"
                className="btn btn-primary btn-lg btn-block checkout-go"
                disabled={isSubmitting || isRefreshing || blockedReason !== ""}
              >
                {isSubmitting
                  ? "Holding your items..."
                  : issue?.type === "unconfirmed" ? "Try again with the same details" : <>Continue to payment<ArrowRight aria-hidden="true" size={18} /></>}
              </button>
            </>
          )}
          <p className="checkout-small">Nothing is charged yet. Your items are held for you for a short time.</p>
        </OrderPanel>
      </div>
    </div>
  )
}

export default CheckoutPage
