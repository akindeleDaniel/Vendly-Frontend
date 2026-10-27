import { useEffect, useState, type ReactNode } from "react"
import { Check, Clock, Hourglass, MapPin, Search, WifiOff, XCircle } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import CheckoutSteps from "../components/CheckoutSteps"
import type { CheckoutStep } from "../components/CheckoutSteps"
import PaymentOptions from "../components/PaymentOptions"
import { fetchPayment } from "../lib/paymentApi"
import { fetchMyOrder, formatHeldUntil } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import type { CustomerOrder } from "../types/order"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { Payment } from "../types/payment"
import { formatNaira } from "../lib/money"

// While the payment is pending, the backend is asked again every few seconds for about two minutes.
const POLL_INTERVAL_MS = 4000
const MAX_POLLS = 30

const providerNames = { PAYSTACK: "Paystack", FLUTTERWAVE: "Flutterwave" } as const

type LoadState =
    | { kind: "loading" }
    | { kind: "ready", payment: Payment }
    | { kind: "missing" }// no reference in the address, or not one of this shopper's payments
    | { kind: "error", message: string }

// Paystack sends the shopper back here with ?reference=..., Flutterwave with ?tx_ref=... . The address
// alone proves nothing: the page only shows what the backend confirms after checking with the provider.
// The last step of checkout. Paid: what happens next and the orders. Not yet: it keeps checking. Not
// paid: try again while the items are held, or go back to the cart once the hold has run out.
function PaymentReturnPage({ userName = "" }: { userName?: string }) {
    const firstName = userName.trim().split(/\s+/)[0]
    useDocumentTitle("Payment")
    const [searchParams] = useSearchParams()
    const reference = searchParams.get("reference") ?? searchParams.get("trxref") ?? searchParams.get("tx_ref")
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

    // Once the payment is confirmed, the orders it made (each shop's part, and the address).
    const paidCheckoutId = state.kind === "ready" && state.payment.status === "SUCCESS" && state.payment.checkout.status === "COMPLETED"
        ? state.payment.checkout.id
        : null
    const [orderState, setOrderState] = useState<OrderOutcome<CustomerOrder> | { kind: "loading" }>({ kind: "loading" })

    useEffect(() => {
        if (paidCheckoutId === null) {
            return
        }
        const controller = new AbortController()
        fetchMyOrder(String(paidCheckoutId), controller.signal).then((outcome) => {
            if (!controller.signal.aborted) {
                setOrderState(outcome)
            }
        })
        return () => controller.abort()
    }, [paidCheckoutId])

    function checkAgain() {
        setPolls(0)
        setCheckAttempt((attempt) => attempt + 1)
    }

    const page = (current: CheckoutStep, content: ReactNode) => (
        <div className="checkout-page result-page">
            <div className="result-steps"><CheckoutSteps current={current} /></div>
            <div className="result-column">{content}</div>
        </div>
    )

    if (state.kind === "loading") {
        return page("pay", (
            <section className="checkout-card result-hero" role="status" aria-labelledby="result-heading">
                <span className="result-spinner" aria-hidden="true" />
                <h1 id="result-heading">Checking your payment</h1>
                <p>This only takes a moment.</p>
            </section>
        ))
    }

    if (state.kind === "missing") {
        return page("pay", (
            <section className="checkout-card result-hero" aria-labelledby="result-heading">
                <span className="result-badge is-warning" aria-hidden="true"><Search size={36} /></span>
                <h1 id="result-heading">We could not find this payment</h1>
                <p>If you have just paid, it may take a moment to show. Check My orders, or go back to your cart.</p>
                <div className="result-actions">
                    <Link to="/orders" className="btn btn-primary btn-lg">See my orders</Link>
                    <Link to="/cart" className="btn btn-lg">Back to cart</Link>
                </div>
            </section>
        ))
    }

    if (state.kind === "error") {
        return page("pay", (
            <section className="checkout-card result-hero" aria-labelledby="result-heading">
                <span className="result-badge is-warning" aria-hidden="true"><WifiOff size={36} /></span>
                <h1 id="result-heading">We could not check your payment</h1>
                <p>{state.message}</p>
                <div className="result-actions">
                    <button type="button" className="btn btn-primary btn-lg" onClick={checkAgain}>Check again</button>
                </div>
            </section>
        ))
    }

    const { payment } = state
    const providerName = providerNames[payment.provider]
    const checkoutExpired = payment.checkout.status === "EXPIRED"

    if (payment.status === "SUCCESS" && payment.checkout.status === "COMPLETED") {
        const order = orderState.kind === "ok" ? orderState.data : null
        const shopCount = order?.sellerOrders.length ?? 0

        return page("done", (
            <>
                <section className="checkout-card result-hero" aria-labelledby="result-heading">
                    <span className="result-badge is-success" aria-hidden="true"><Check size={40} strokeWidth={2.4} /></span>
                    <h1 id="result-heading">Payment confirmed</h1>
                    <p>
                        Thank you{firstName ? `, ${firstName}` : ""}. We have your payment of <b>{formatNaira(payment.amount)}</b>
                        {shopCount > 0 ? ` and your ${shopCount === 1 ? "order has" : "orders have"} gone to ${shopCount} ${shopCount === 1 ? "shop" : "shops"}.` : " and your order has gone to the shop."}
                    </p>
                    <p className="result-facts">
                        <span>Paid with <b>{providerName}</b></span>
                        <span>Reference <b>{payment.reference}</b></span>
                    </p>
                    <div className="result-actions">
                        <Link to={`/orders/${payment.checkout.id}`} className="btn btn-primary btn-lg">View my order</Link>
                        <Link to="/" className="btn btn-lg">Keep shopping</Link>
                    </div>
                </section>

                <section className="checkout-card" aria-labelledby="next-heading">
                    <h2 id="next-heading" className="result-title">What happens next</h2>
                    <ol className="result-next">
                        <li><span>1</span><b>The {shopCount > 1 ? "shops get" : "shop gets"} it ready</b>{shopCount > 1 ? "Each shop packs its part of your order and sends it to you." : "The shop packs your order and sends it to you."}</li>
                        <li><span>2</span><b>It is on its way</b>My orders shows when your order has been sent.</li>
                        <li><span>3</span><b>Confirm when it arrives</b>Press "I received it" in My orders. If something is wrong, raise a complaint there instead.</li>
                    </ol>
                </section>

                {order && (
                    <section className="checkout-card" aria-labelledby="orders-heading">
                        <h2 id="orders-heading" className="result-title">{shopCount === 1 ? "Your order" : "Your orders"}</h2>
                        <ul className="result-orders">
                            {order.sellerOrders.map((sellerOrder) => {
                                const itemCount = sellerOrder.items.reduce((sum, item) => sum + item.quantity, 0)
                                return (
                                    <li key={sellerOrder.id}>
                                        <div>
                                            <b>{sellerOrder.seller?.businessName ?? "Shop"}</b>
                                            <span>Order #{sellerOrder.id} · {itemCount} {itemCount === 1 ? "item" : "items"} · {formatNaira(sellerOrder.total)}</span>
                                            <span className="result-items">{sellerOrder.items.map((item) => item.title).join(", ")}</span>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                        <p className="result-address">
                            <MapPin aria-hidden="true" size={18} />
                            Delivering to {order.delivery.fullName}, {order.delivery.address}, {order.delivery.lga}, {order.delivery.state}
                        </p>
                    </section>
                )}
            </>
        ))
    }

    if (isPending) {
        const stoppedPolling = polls >= MAX_POLLS

        if (!stoppedPolling || payment.status === "SUCCESS") {
            return page("pay", (
                <section className="checkout-card result-hero" role="status" aria-labelledby="result-heading">
                    <span className="result-spinner" aria-hidden="true" />
                    <h1 id="result-heading">{payment.status === "SUCCESS" ? "Finishing your order" : "Confirming your payment"}</h1>
                    <p>
                        {payment.status === "SUCCESS"
                            ? "Your payment was received and we are finishing your order. This page updates by itself."
                            : `We are waiting for ${providerName} to confirm it. This page updates by itself, so keep it open. It usually takes a few seconds.`}
                    </p>
                    <p className="result-facts"><span>Reference <b>{payment.reference}</b></span></p>
                    <p className="result-small">You will not be charged twice, even if you refresh.</p>
                </section>
            ))
        }

        return page("pay", (
            <section className="checkout-card result-hero" aria-labelledby="result-heading">
                <span className="result-badge is-warning" aria-hidden="true"><Clock size={36} /></span>
                <h1 id="result-heading">{providerName} has not confirmed yet</h1>
                <p>If you finished paying, it will be confirmed by itself and your order will appear in My orders. If you left before finishing, go back to {providerName}.</p>
                <p className="result-facts"><span>Reference <b>{payment.reference}</b></span></p>
                <div className="result-actions">
                    <button type="button" className="btn btn-primary btn-lg" onClick={checkAgain}>Check again</button>
                    {payment.status === "PENDING" && payment.authorizationUrl && !checkoutExpired && (
                        <a href={payment.authorizationUrl} className="btn btn-lg">Go back to {providerName}</a>
                    )}
                </div>
            </section>
        ))
    }

    if (checkoutExpired) {
        return page("failed", (
            <section className="checkout-card result-hero" aria-labelledby="result-heading">
                <span className="result-badge is-quiet" aria-hidden="true"><Hourglass size={36} /></span>
                <h1 id="result-heading">Your checkout ran out of time</h1>
                <p>Nothing was charged. Your items are no longer held for you, but they are still in your cart, so you can check out again.</p>
                <div className="result-actions">
                    <Link to="/cart" className="btn btn-primary btn-lg">Back to cart</Link>
                </div>
            </section>
        ))
    }

    return page("failed", (
        <>
            <section className="checkout-card result-hero" aria-labelledby="result-heading">
                <span className="result-badge is-error" aria-hidden="true"><XCircle size={36} /></span>
                <h1 id="result-heading">Payment not completed</h1>
                <p>
                    {payment.failureReason
                        ? <>{providerName} said: <b>"{payment.failureReason}"</b> </>
                        : "Your payment did not go through. "}
                    Nothing was charged.
                </p>
            </section>
            <PaymentOptions checkoutId={payment.checkout.id} total={payment.amount} heading="Try again">
                <p className="checkout-held">
                    <Clock aria-hidden="true" size={20} />
                    <span><b>Your items are still held for you until {formatHeldUntil(payment.checkout.expiresAt)}.</b> Try again, or pay another way.</span>
                </p>
            </PaymentOptions>
            <Link to="/cart" className="page-link-center">Back to cart</Link>
        </>
    ))
}

export default PaymentReturnPage
