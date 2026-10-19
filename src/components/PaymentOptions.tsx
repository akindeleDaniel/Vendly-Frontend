import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import Notice from "./Notice"
import { startPayment } from "../lib/paymentApi"

type Problem =
    | { kind: "sellers-not-ready", message: string, sellers: string[] }
    | { kind: "expired" | "already-paid" | "try-again" | "error", message: string }
    | { kind: "unconfirmed" }

// Lets the shopper pay for a checkout. Paystack's own page takes the payment; the shopper then
// returns to /checkout/payment-return, which asks the backend for the confirmed result.
// Asking again is safe: the backend returns the payment already in progress instead of a new one.
function PaymentOptions({ checkoutId }: { checkoutId: number }) {
    const [isStarting, setIsStarting] = useState(false)
    const [problem, setProblem] = useState<Problem | null>(null)
    const startingRef = useRef(false)

    async function payWithPaystack() {
        if (startingRef.current) {
            return
        }

        startingRef.current = true
        setIsStarting(true)
        setProblem(null)

        const outcome = await startPayment(checkoutId, "PAYSTACK")

        if (outcome.kind === "redirect" && outcome.payment.authorizationUrl) {
            // Stay in the "starting" state while the browser leaves for Paystack.
            window.location.assign(outcome.payment.authorizationUrl)
            return
        }

        startingRef.current = false
        setIsStarting(false)

        if (outcome.kind !== "redirect" && outcome.kind !== "unauthorized") {
            setProblem(outcome)
        }
    }

    const blocked = problem?.kind === "expired" || problem?.kind === "already-paid"

    return (
        <section aria-labelledby="payment-heading" className="card summary-card">
            <h2 id="payment-heading">Payment</h2>
            <p>You will pay on Paystack's secure page, then come back here to see your confirmed order.</p>

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
                    <button type="button" className="btn btn-primary btn-lg" onClick={payWithPaystack} disabled={isStarting}>
                        {isStarting ? "Opening Paystack..." : "Pay with Paystack"}
                    </button>
                    <button type="button" className="btn btn-lg" disabled aria-describedby="flutterwave-soon">
                        Pay with Flutterwave
                    </button>
                </div>
            )}
            <p id="flutterwave-soon" className="form-hint">Flutterwave is coming soon.</p>
        </section>
    )
}

export default PaymentOptions
