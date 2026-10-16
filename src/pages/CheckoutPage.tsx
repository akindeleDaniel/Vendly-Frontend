import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import DeliveryFields from "../components/DeliveryFields"
import { fetchCheckoutPreview, submitCheckout, validateDelivery } from "../lib/checkoutApi"
import type { DeliveryValidationError } from "../lib/checkoutApi"
import type { CheckoutResult, CheckoutReview, DeliveryDetails, LockedCheckout } from "../types/checkout"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type PreviewStatus = "loading" | "ready" | "empty" | "blocked" | "error"

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
function ReviewSummary({ review }: { review: CheckoutReview }) {
  return (
    <section aria-labelledby="order-summary-heading">
      <h2 id="order-summary-heading">Order summary</h2>
      {review.sellers.map((group) => (
        <article key={group.seller.slug}>
          <h3>
            <Link to={`/shop/${encodeURIComponent(group.seller.slug)}`}>{group.seller.businessName}</Link>
          </h3>
          <ul>
            {group.items.map((item) => (
              <li key={item.listingId}>
                <p>{item.title}</p>
                <p>Unit price: {item.unitPrice}</p>
                <p>Quantity: {item.quantity}</p>
                <p>Line subtotal: {item.lineSubtotal}</p>
              </li>
            ))}
          </ul>
          <p>Seller subtotal: {group.subtotal}</p>
          <p>Shipping: {group.shipping}</p>
          <p>Seller total: {group.total}</p>
        </article>
      ))}
      <p>Subtotal: {review.subtotal}</p>
      <p>Shipping: {review.shipping}</p>
      <p>Total: {review.total}</p>
    </section>
  )
}

function CheckoutSuccess({ result }: { result: CheckoutResult }) {
  return (
    <div>
      <h1>Checkout created</h1>
      <p role="status">
        Your checkout has been created, but payment has not been completed and payment is not available yet.
        Nothing has been charged.
      </p>
      {result.code === "CHECKOUT_REUSED" && (
        <p>You already had an identical checkout, so it has been kept as it was.</p>
      )}
      {result.code === "CHECKOUT_REPLACED" && (
        <p>Your earlier pending checkout was replaced by this one.</p>
      )}
      <p>Checkout reference: {result.checkout.id}</p>
      <p>Status: {formatStatus(result.checkout.status)}</p>
      <p>Expires: {formatTime(result.checkout.expiresAt)}</p>
      <p>
        Your items are held for you until then. After that, this checkout expires and you would need to create a new one.
      </p>

      <section aria-labelledby="orders-heading">
        <h2 id="orders-heading">Orders</h2>
        {result.orders.map((order) => (
          <article key={order.id}>
            <h3>{order.seller ? order.seller.businessName : "Seller"}</h3>
            <p>Order reference: {order.id}</p>
            <p>Status: {formatStatus(order.status)}</p>
            <ul>
              {order.items.map((item) => (
                <li key={item.listingId}>
                  {item.title}: {item.quantity} × {item.unitPrice}
                </li>
              ))}
            </ul>
            <p>Subtotal: {order.subtotal}</p>
            <p>Shipping: {order.shipping}</p>
            <p>Order total: {order.total}</p>
          </article>
        ))}
        <p>Subtotal: {result.subtotal}</p>
        <p>Shipping: {result.shipping}</p>
        <p>Total: {result.total}</p>
      </section>

      <p>Your cart has not been changed.</p>
      <Link to="/cart">Back to cart</Link>
      {" "}
      <Link to="/">Keep browsing</Link>
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
  // The name is left blank: the session check returns only the role, so there is no reliable
  // source to prefill it from.
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
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const submittingRef = useRef(false)
  const noticeRef = useRef<HTMLDivElement>(null)
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

    if (submittingRef.current || isRefreshing || review === null || reviewNotice !== null || isBlocked) {
      return
    }

    const deliveryError = validateDelivery(delivery)
    if (deliveryError) {
      setValidationError(deliveryError)
      return
    }

    setValidationError(null)
    setIssue(null)
    submittingRef.current = true// blocks a second submit even before the next render disables the button
    setIsSubmitting(true)

    try {
      const outcome = await submitCheckout(delivery, review.reviewToken)

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
        <div role="alert">
          <p>{previewMessage}</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
        </div>
        <Link to="/cart">Back to cart</Link>
      </div>
    )
  }

  if (previewStatus === "empty") {
    return (
      <div>
        <h1>Checkout</h1>
        <p>Your cart is empty, so there is nothing to check out.</p>
        <Link to="/">Keep browsing</Link>
      </div>
    )
  }

  if (previewStatus === "blocked") {
    return (
      <div>
        <h1>Checkout</h1>
        <div role="alert">
          <p>
            One or more items in your cart cannot be checked out right now, for example because there is not enough stock.
            Please review your cart.
          </p>
          {(issue?.type === "items-unavailable" || issue?.type === "error") && <p>{issue.message}</p>}
        </div>
        <Link to="/cart">Back to cart</Link>
        {" "}
        <button type="button" onClick={() => refreshPreview("check-again")} disabled={isRefreshing}>
          {isRefreshing ? "Checking..." : "Check again"}
        </button>
      </div>
    )
  }

  if (review === null) {
    return null// not reachable: a ready checkout always has a review
  }

  return (
    <div>
      <h1>Checkout</h1>
      <p>
        Creating a checkout reserves your items for a short time. It does not take payment, and payment is not available yet.
      </p>

      <ReviewSummary review={review} />

      {reviewNotice && (
        <div role="alert" ref={noticeRef} tabIndex={-1}>
          <p>{reviewNotice.message}</p>
          {reviewNotice.previousTotal !== null && (
            <p>Previous total: {reviewNotice.previousTotal}. New total: {review.total}.</p>
          )}
          <button type="button" onClick={() => setReviewNotice(null)}>
            I've reviewed the updated totals
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h2>Delivery details</h2>
        <DeliveryFields
          formData={delivery}
          setFormData={updateDelivery}
          disabled={isSubmitting}
          invalidField={validationError?.field}
          errorId="delivery-error"
        />

        {validationError && <p role="alert" id="delivery-error">{validationError.message}</p>}

        {issue?.type === "items-unavailable" && (
          <div role="alert">
            <p>
              {issue.itemTitle
                ? `"${issue.itemTitle}" cannot be checked out right now (for example, there is not enough stock).`
                : "An item in your cart cannot be checked out right now (for example, there is not enough stock)."}
              {" "}Your checkout was not created. Please review your cart.
            </p>
            <Link to="/cart">Back to cart</Link>
          </div>
        )}
        {issue?.type === "locked" && (
          <div role="alert">
            <p>
              You already have a checkout that cannot be replaced right now, so a new one was not created.
              {" "}{issue.message}.
            </p>
            {issue.checkout && (
              <p>
                Existing checkout {issue.checkout.id}: status {formatStatus(issue.checkout.status)}, expires {formatTime(issue.checkout.expiresAt)}.
              </p>
            )}
            <p>You can try again after it expires.</p>
          </div>
        )}
        {issue?.type === "conflict" && <p role="alert">{issue.message}</p>}
        {issue?.type === "invalid" && (
          <p role="alert">
            The server did not accept your delivery details. Please check each field and try again.
          </p>
        )}
        {issue?.type === "unconfirmed" && (
          <p role="alert">
            We could not confirm whether your checkout was created. It may or may not have gone through.
            You can try again with the same details: if it already exists, it will be kept rather than duplicated.
          </p>
        )}
        {issue?.type === "error" && <p role="alert">{issue.message}</p>}

        {isBlocked ? (
          <button type="button" onClick={() => refreshPreview(issue?.type === "conflict" ? "conflict" : "check-again")} disabled={isRefreshing}>
            {isRefreshing ? "Checking..." : "Check again"}
          </button>
        ) : (
          <button type="submit" disabled={isSubmitting || isRefreshing || reviewNotice !== null}>
            {isSubmitting
              ? "Creating checkout..."
              : issue?.type === "unconfirmed" ? "Try again with the same details" : "Create checkout"}
          </button>
        )}
        {reviewNotice !== null && (
          <p>Confirm the updated totals above to continue.</p>
        )}
      </form>

      {/* Not offered while a request is in flight, so the shopper cannot walk away from an unseen outcome. */}
      {!isSubmitting && <Link to="/cart">Back to cart</Link>}
    </div>
  )
}

export default CheckoutPage
