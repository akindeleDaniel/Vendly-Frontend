import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import Notice from "../components/Notice"
import PaymentOptions from "../components/PaymentOptions"
import { fetchPayment } from "../lib/paymentApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { Payment } from "../types/payment"

// While the payment is pending, the backend is asked again every few seconds for about two minutes.
const POLL_INTERVAL_MS = 4000
const MAX_POLLS = 30

type LoadState =
    | { kind: "loading" }
    | { kind: "ready", payment: Payment }
    | { kind: "missing" }// no reference in the address, or not one of this shopper's payments
    | { kind: "error", message: string }

// Paystack sends the shopper back here with ?reference=... . The address alone proves nothing:
// the page only shows what the backend confirms after checking with Paystack.
function PaymentReturnPage() {
    useDocumentTitle("Payment")
    const [searchParams] = useSearchParams()
    const reference = searchParams.get("reference") ?? searchParams.get("trxref")
    const [state, setState] = useState<LoadState>(reference ? { kind: "loading" } : { kind: "missing" })
    const [polls, setPolls] = useState(0)
    const [checkAttempt, setCheckAttempt] = useState(0)

    useEffect(() => {
        if (!reference) {
            return
        }

        const controller = new AbortController()

        async function check() {
            const outcome = await fetchPayment(reference!, controller.signal)

            if (controller.signal.aborted) {
                return
            }

            switch (outcome.kind) {
                case "ok":
                    setState({ kind: "ready", payment: outcome.payment })
                    break
                case "not-found":
                    setState({ kind: "missing" })
                    break
                case "network-error":
                    setState({ kind: "error", message: "We could not reach the server. Please check your connection." })
                    break
                case "error":
                    setState({ kind: "error", message: outcome.message })
                    break
                case "unauthorized":
                    break// the session guard sends the shopper to log in
            }
        }

        check()
        return () => controller.abort()
    }, [reference, checkAttempt])

    const isPending = state.kind === "ready" && (
        state.payment.status === "PENDING" ||
        (state.payment.status === "SUCCESS" && state.payment.checkout.status !== "COMPLETED")
    )

    useEffect(() => {
        if (!isPending || polls >= MAX_POLLS) {
            return
        }

        const timer = window.setTimeout(() => {
            setPolls((count) => count + 1)
            setCheckAttempt((attempt) => attempt + 1)
        }, POLL_INTERVAL_MS)

        return () => window.clearTimeout(timer)
    }, [isPending, polls, checkAttempt])

    function checkAgain() {
        setPolls(0)
        setCheckAttempt((attempt) => attempt + 1)
    }

    if (state.kind === "loading") {
        return <p role="status">Checking your payment with Paystack...</p>
    }

    if (state.kind === "missing") {
        return (
            <div>
                <h1>Payment</h1>
                <Notice kind="warning">We could not find this payment. If you have just paid, check your cart or try again shortly.</Notice>
                <Link to="/cart" className="btn">Back to cart</Link>
            </div>
        )
    }

    if (state.kind === "error") {
        return (
            <div>
                <h1>Payment</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={checkAgain}>Check again</button>
                </Notice>
            </div>
        )
    }

    const { payment } = state
    const checkoutExpired = payment.checkout.status === "EXPIRED"

    if (payment.status === "SUCCESS" && payment.checkout.status === "COMPLETED") {
        return (
            <div>
                <h1>Payment confirmed</h1>
                <Notice kind="success">
                    Thank you. Your payment of {payment.currency} {payment.amount} is confirmed and your order has been sent to the seller.
                </Notice>
                <dl className="card status-list">
                    <div><dt>Payment reference</dt><dd>{payment.reference}</dd></div>
                    <div><dt>Checkout reference</dt><dd>{payment.checkout.id}</dd></div>
                </dl>
                <p className="summary-note">The items you paid for have been removed from your cart.</p>
                <Link to="/" className="btn btn-primary">Keep browsing</Link>
            </div>
        )
    }

    if (isPending) {
        const stoppedPolling = polls >= MAX_POLLS

        return (
            <div>
                <h1>Confirming your payment</h1>
                <Notice kind="info">
                    {payment.status === "SUCCESS"
                        ? "Your payment was received and we are finishing your order."
                        : stoppedPolling
                            ? "Paystack has not confirmed this payment yet. If you completed it, it will be confirmed automatically; you can check again later."
                            : "We are waiting for Paystack to confirm your payment. This page updates by itself."}
                </Notice>
                <p className="form-hint">Payment reference: {payment.reference}</p>
                <div className="action-row">
                    {stoppedPolling && <button type="button" className="btn" onClick={checkAgain}>Check again</button>}
                    {payment.status === "PENDING" && payment.authorizationUrl && !checkoutExpired && (
                        <a href={payment.authorizationUrl} className="btn">Return to Paystack to finish paying</a>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div>
            <h1>Payment not completed</h1>
            <Notice kind="error">
                <p>{payment.failureReason ?? "Your payment was not completed."}</p>
            </Notice>
            {checkoutExpired ? (
                <>
                    <p>Your checkout has expired, so your items are no longer reserved.</p>
                    <Link to="/cart" className="btn btn-primary">Back to cart</Link>
                </>
            ) : (
                <PaymentOptions checkoutId={payment.checkout.id} />
            )}
        </div>
    )
}

export default PaymentReturnPage
