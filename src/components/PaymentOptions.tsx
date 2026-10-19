import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import Notice from "./Notice"
import { startPayment } from "../lib/paymentApi"
import type { PaymentProvider } from "../types/payment"

type Problem =
    | { kind: "sellers-not-ready", message: string, sellers: string[] }
    | { kind: "expired" | "already-paid" | "try-again" | "error", message: string }
    | { kind: "unconfirmed" }

// Lets the shopper pay for a checkout with Paystack or Flutterwave. The provider's own page takes
// the payment; the shopper then returns to /checkout/payment-return, which asks the backend for the
// confirmed result.
// Asking again is safe: the backend returns the payment already in progress instead of a new one.
function PaymentOptions({ checkoutId }: { checkoutId: number }) {
    const [startingWith, setStartingWith] = useState<PaymentProvider | null>(null)
    const [problem, setProblem] = useState<Problem | null>(null)
    const startingRef = useRef(false)

    async function pay(provider: PaymentProvider) {
        if (startingRef.current) {
            return
        }

        startingRef.current = true
        setStartingWith(provider)
        setProblem(null)

        const outcome = await startPayment(checkoutId, provider)

        if (outcome.kind === "redirect" && outcome.payment.authorizationUrl) {
            // Stay in the "starting" state while the browser leaves for the payment page.
            window.location.assign(outcome.payment.authorizationUrl)
            return
        }

        startingRef.current = false
        setStartingWith(null)

        if (outcome.kind !== "redirect" && outcome.kind !== "unauthorized") {
            setProblem(outcome)
        }
    }

    const blocked = problem?.kind === "expired" || problem?.kind === "already-paid"

    return (
        <section aria-labelledby="payment-heading" className="card summary-card">
            <h2 id="payment-heading">Payment</h2>
            <p>Choose how to pay. You will pay on the provider's secure page, then come back here to see your confirmed order.</p>

            {problem?.kind === "sellers-not-ready" && (
                <Notice kind="error">
                    <p>{problem.message}.</p>
                    {problem.sellers.length > 0 && <p>Not ready yet: {problem.sellers.join(", ")}.</p>}
                    <p>You can remove their items from your cart and check out again, or try again later.</p>
                </Notice>
            )}
            {problem?.kind === "expired" && (
                <Notice kind="warning">
                    <p>{problem.message}</p>
                    <Link to="/cart" className="btn">Back to cart</Link>
                </Notice>
            )}
            {problem?.kind === "already-paid" && <Notice kind="success">{problem.message}</Notice>}
            {(problem?.kind === "try-again" || problem?.kind === "error") && <Notice kind="error">{problem.message}</Notice>}
            {problem?.kind === "unconfirmed" && (
                <Notice kind="warning">
                    We could not confirm whether your payment was started. Try again: you will not be charged twice.
                </Notice>
            )}

            {!blocked && (
                <div className="action-row">
                    <button type="button" className="btn btn-primary btn-lg" onClick={() => pay("PAYSTACK")} disabled={startingWith !== null}>
                        {startingWith === "PAYSTACK" ? "Opening Paystack..." : "Pay with Paystack"}
                    </button>
                    <button type="button" className="btn btn-primary btn-lg" onClick={() => pay("FLUTTERWAVE")} disabled={startingWith !== null}>
                        {startingWith === "FLUTTERWAVE" ? "Opening Flutterwave..." : "Pay with Flutterwave"}
                    </button>
                </div>
            )}
        </section>
    )
}

export default PaymentOptions
