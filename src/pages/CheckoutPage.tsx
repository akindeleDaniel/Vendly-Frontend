import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import DeliveryFields from "../components/DeliveryFields"
import Notice from "../components/Notice"
import PaymentOptions from "../components/PaymentOptions"
import PreOrderCheckoutBlock from "../components/PreOrderCheckoutBlock"
import { fetchCheckoutPreview, submitCheckout, validateDelivery } from "../lib/checkoutApi"
import type { OrderTooLarge } from "../lib/checkoutApi"
import { ORDER_MAX_VALUE } from "../lib/limits"
import type { DeliveryValidationError } from "../lib/checkoutApi"
import type { CheckoutResult, CheckoutReview, DeliveryDetails, LockedCheckout } from "../types/checkout"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { formatNaira } from "../lib/money"

type PreviewStatus = "loading" | "ready" | "empty" | "blocked" | "too-large" | "error"

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

function formatStatus(status: string): string {
  if (status === "PENDING") {
    return "Pending"
  }
  if (status === "PENDING_PAYMENT") {
    return "Pending payment"
  }
  return status
}

// Every amount here is a string calculated by the server and is shown exactly as received.
function ReviewSummary({ review, onCheckAgain, isRefreshing }: { review: CheckoutReview, onCheckAgain: () => void, isRefreshing: boolean }) {
  return (
    <section aria-labelledby="order-summary-heading" className="checkout-summary">
      <h2 id="order-summary-heading">Order summary</h2>
      {review.sellers.map((group) => (
        <article key={group.seller.slug} className="card summary-card">
          <h3>
            <Link to={`/shop/${encodeURIComponent(group.seller.slug)}`}>{group.seller.businessName}</Link>
          </h3>
          <ul className="order-lines">
            {group.items.map((item) => (
              <li key={item.listingId} className="order-line">
                <div>
                  <p className="order-line-title">{item.title}</p>
                  <p className="order-line-meta">{formatNaira(item.unitPrice)} × {item.quantity}</p>
                </div>
                <span className="order-line-amount">{formatNaira(item.lineSubtotal)}</span>
              </li>
            ))}
          </ul>
          <PreOrderCheckoutBlock group={group} onCheckAgain={onCheckAgain} isRefreshing={isRefreshing} />
          <hr className="summary-divider" />
          <div className="summary-row"><span>Seller subtotal</span><span>{formatNaira(group.subtotal)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{formatNaira(group.shipping)}</span></div>
          <div className="summary-row summary-row-total"><span>Seller total</span><span>{formatNaira(group.total)}</span></div>
        </article>
      ))}
      <div className="card summary-card">
        <div className="summary-row"><span>Subtotal</span><span>{formatNaira(review.subtotal)}</span></div>
        <div className="summary-row"><span>Shipping</span><span>{formatNaira(review.shipping)}</span></div>
        <hr className="summary-divider" />
        <div className="summary-row summary-row-total">
          <span>Total</span>
          <span className="summary-total-amount">{formatNaira(review.total)}</span>
        </div>
      </div>
    </section>
  )
}

function CheckoutSuccess({ result }: { result: CheckoutResult }) {
  return (
    <div>
      <h1>Checkout created</h1>
      <Notice kind="success">
        Your checkout has been created and your items are reserved. Nothing has been charged yet: pay below to complete your order.
      </Notice>
      {result.code === "CHECKOUT_REUSED" && (
        <p>You already had an identical checkout, so it has been kept as it was.</p>
      )}
      {result.code === "CHECKOUT_REPLACED" && (
        <p>Your earlier pending checkout was replaced by this one.</p>
      )}
      <dl className="card status-list">
        <div><dt>Checkout reference</dt><dd>{result.checkout.id}</dd></div>
        <div><dt>Status</dt><dd><span className="badge">{formatStatus(result.checkout.status)}</span></dd></div>
        <div><dt>Expires</dt><dd>{formatTime(result.checkout.expiresAt)}</dd></div>
      </dl>
      <p className="summary-note">
        Your items are held for you until then. Starting payment extends the hold to 30 minutes. After that, this checkout
        expires and you would need to create a new one.
      </p>

      <PaymentOptions checkoutId={result.checkout.id} />

      <section aria-labelledby="orders-heading">
        <h2 id="orders-heading">Orders</h2>
        {result.orders.map((order) => (
          <article key={order.id} className="card summary-card">
            <div className="order-header">
              <h3>{order.seller ? order.seller.businessName : "Seller"}</h3>
              <span className="badge">{formatStatus(order.status)}</span>
            </div>
            <p className="order-line-meta">Order reference: {order.id}</p>
            <ul className="order-lines">
              {order.items.map((item) => (
                <li key={item.listingId} className="order-line">
                  <span>{item.title}: {item.quantity} × {formatNaira(item.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <hr className="summary-divider" />
            <div className="summary-row"><span>Subtotal</span><span>{formatNaira(order.subtotal)}</span></div>
            <div className="summary-row"><span>Shipping</span><span>{formatNaira(order.shipping)}</span></div>
            <div className="summary-row summary-row-total"><span>Order total</span><span>{formatNaira(order.total)}</span></div>
          </article>
        ))}
        <div className="summary-row summary-row-total">
          <span>Total</span>
          <span className="summary-total-amount">{formatNaira(result.total)}</span>
        </div>
      </section>

      <p className="summary-note">Your cart stays as it is until your payment is confirmed.</p>
      <div className="action-row">
        <Link to="/cart" className="btn">Back to cart</Link>
        <Link to="/">Keep browsing</Link>
      </div>
    </div>
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
    const outcome = await fetchCheckoutPreview()
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

    if (submittingRef.current || isRefreshing || review === null || reviewNotice !== null || isBlocked || waitingForPreOrder) {
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

  if (result) {
    return <CheckoutSuccess result={result} />
  }

  if (previewStatus === "loading") {
    return <p role="status">Loading checkout...</p>
  }

  if (previewStatus === "error") {
    return (
      <div>
        <h1>Checkout</h1>
        <Notice kind="error">
          <p>{previewMessage}</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
        </Notice>
        <Link to="/cart">Back to cart</Link>
      </div>
    )
  }

  if (previewStatus === "too-large") {
    return (
      <div>
        <h1>Checkout</h1>
        <Notice kind="warning">{previewMessage}</Notice>
        <Link to="/cart" className="btn">Back to cart</Link>
      </div>
    )
  }

  if (previewStatus === "empty") {
    return (
      <div>
        <h1>Checkout</h1>
        <p>Your cart is empty, so there is nothing to check out.</p>
        <Link to="/" className="btn btn-primary">Keep browsing</Link>
      </div>
    )
  }

  if (previewStatus === "blocked") {
    return (
      <div>
        <h1>Checkout</h1>
        <Notice kind="error">
          <p>
            One or more items in your cart cannot be checked out right now, for example because there is not enough stock.
            Please review your cart.
          </p>
          {(issue?.type === "items-unavailable" || issue?.type === "error") && <p>{issue.message}</p>}
        </Notice>
        <div className="action-row">
          <Link to="/cart" className="btn">Back to cart</Link>
          <button type="button" onClick={() => refreshPreview("check-again")} disabled={isRefreshing}>
            {isRefreshing ? "Checking..." : "Check again"}
          </button>
        </div>
      </div>
    )
  }

  if (review === null) {
    return null// not reachable: a ready checkout always has a review
  }

  return (
    <div>
      <h1>Checkout</h1>
      <Notice kind="info" role="none">
        Creating a checkout reserves your items for a short time. You will pay with Paystack on the next step.
        An order from one shop can be up to {formatNaira(ORDER_MAX_VALUE)}, delivery included.
      </Notice>

      <div className="checkout-layout">
        <ReviewSummary review={review} onCheckAgain={() => refreshPreview("check-again")} isRefreshing={isRefreshing} />

        <div className="checkout-main">
          {reviewNotice && (
            <Notice kind="warning" ref={noticeRef} tabIndex={-1}>
              <p>{reviewNotice.message}</p>
              {reviewNotice.previousTotal !== null && (
                <p><strong>Previous total: {formatNaira(reviewNotice.previousTotal)}. New total: {formatNaira(review.total)}.</strong></p>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setReviewNotice(null)}>
                I've reviewed the updated totals
              </button>
            </Notice>
          )}

          <form onSubmit={handleSubmit} className="checkout-form">
            <h2>Delivery details</h2>
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
            {issue?.type === "locked" && issue.checkout && <PaymentOptions checkoutId={issue.checkout.id} />}
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
            {waitingForPreOrder && (
              <Notice kind="info">A shop in your cart only takes pre-orders. Ask it for a time in the order summary and wait for its approval before you pay.</Notice>
            )}

            {isBlocked ? (
              <button type="button" className="btn-block btn-lg" onClick={() => refreshPreview(issue?.type === "conflict" ? "conflict" : "check-again")} disabled={isRefreshing}>
                {isRefreshing ? "Checking..." : "Check again"}
              </button>
            ) : (
              <button type="submit" className="btn-block btn-lg" disabled={isSubmitting || isRefreshing || reviewNotice !== null || waitingForPreOrder}>
                {isSubmitting
                  ? "Creating checkout..."
                  : issue?.type === "unconfirmed" ? "Try again with the same details" : "Create checkout"}
              </button>
            )}
            {reviewNotice !== null && (
              <p className="form-hint">Confirm the updated totals above to continue.</p>
            )}
            <p className="form-hint">Nothing is charged until you pay on the next step.</p>
          </form>

          {/* Not offered while a request is in flight, so the shopper cannot walk away from an unseen outcome. */}
          {!isSubmitting && <Link to="/cart" className="page-link-center">Back to cart</Link>}
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
