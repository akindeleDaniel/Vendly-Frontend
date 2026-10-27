import { useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Lock } from "lucide-react"
import Notice from "./Notice"
import { startPayment } from "../lib/paymentApi"
import { formatNaira } from "../lib/money"
import type { PaymentProvider } from "../types/payment"

type Problem =
    | { kind: "sellers-not-ready", message: string, sellers: string[] }
    | { kind: "expired" | "already-paid" | "try-again" | "error", message: string }
    | { kind: "unconfirmed" }

type PaymentOptionsProps = {
    checkoutId: number
    total?: string // shown on the button ("Pay ₦80,000 with Paystack") when known
    children?: ReactNode // shown above the choices, for example how long the items are held
    heading?: string
}

const PROVIDERS: Array<{ id: PaymentProvider, name: string, methods: string }> = [
    { id: "PAYSTACK", name: "Paystack", methods: "Card, bank transfer or USSD" },
    { id: "FLUTTERWAVE", name: "Flutterwave", methods: "Card, bank transfer or USSD" }
]

// Lets the shopper pay for a checkout with Paystack or Flutterwave. The provider's own page takes
// the payment; the shopper then returns to /checkout/payment-return, which asks the backend for the
// confirmed result.
// Asking again is safe: the backend returns the payment already in progress instead of a new one.
function PaymentOptions({ checkoutId, total, children, heading = "How would you like to pay?" }: PaymentOptionsProps) {
    const [provider, setProvider] = useState<PaymentProvider>("PAYSTACK")
    const [isStarting, setIsStarting] = useState(false)
    const [problem, setProblem] = useState<Problem | null>(null)
    const startingRef = useRef(false)
    const providerName = PROVIDERS.find((option) => option.id === provider)?.name ?? "the provider"

    async function pay() {
        if (startingRef.current) {
            return
        }

        startingRef.current = true
        setIsStarting(true)
        setProblem(null)

        const outcome = await startPayment(checkoutId, provider)

        if (outcome.kind === "redirect" && outcome.payment.authorizationUrl) {
            // Stay in the "starting" state while the browser leaves for the payment page.
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
        <section aria-labelledby="payment-heading" className="checkout-card">
            {children}
            <h2 id="payment-heading" className="checkout-title">{heading}</h2>

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
                <>
                    <fieldset className="pay-choices" disabled={isStarting}>
                        <legend className="visually-hidden">Payment provider</legend>
                        {PROVIDERS.map((option) => (
                            <label key={option.id} className={`pay-choice${provider === option.id ? " is-selected" : ""}`}>
                                <input
                                    type="radio"
                                    name={`provider-${checkoutId}`}
                                    value={option.id}
                                    checked={provider === option.id}
                                    onChange={() => setProvider(option.id)}
                                />
                                <span>
                                    <b>{option.name}</b>
                                    <span>{option.methods}</span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <button type="button" className="btn btn-primary btn-lg btn-block checkout-go" onClick={pay} disabled={isStarting}>
                        <Lock aria-hidden="true" size={18} />
                        {isStarting ? `Opening ${providerName}...` : `Pay ${total ? `${formatNaira(total)} ` : ""}with ${providerName}`}
                    </button>
                    <p className="checkout-small">You finish paying on {providerName}'s secure page, then come back here to see your order.</p>
                </>
            )}
        </section>
    )
}

export default PaymentOptions
