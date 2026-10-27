import { Check } from "lucide-react"

// Where the shopper is in checkout: delivery details, then payment, then the result page.
// "failed" marks the payment step as the one that needs attention.
export type CheckoutStep = "delivery" | "pay" | "done" | "failed"

function CheckoutSteps({ current }: { current: CheckoutStep }) {
  const deliveryDone = current !== "delivery"
  const payDone = current === "done"

  return (
    <ol className="checkout-steps" aria-label="Checkout steps">
      <li className={deliveryDone ? "is-done" : "is-current"} aria-current={deliveryDone ? undefined : "step"}>
        <span className="checkout-step-dot">{deliveryDone ? <Check aria-hidden="true" size={16} /> : "1"}</span>
        Delivery{deliveryDone && <span className="visually-hidden"> (done)</span>}
      </li>
      <li className={deliveryDone ? "checkout-step-bar is-done" : "checkout-step-bar"} aria-hidden="true" />
      <li
        className={payDone ? "is-done" : current === "failed" ? "is-problem" : current === "pay" ? "is-current" : undefined}
        aria-current={current === "pay" || current === "failed" ? "step" : undefined}
      >
        <span className="checkout-step-dot">{payDone ? <Check aria-hidden="true" size={16} /> : current === "failed" ? "!" : "2"}</span>
        Pay{payDone && <span className="visually-hidden"> (done)</span>}{current === "failed" && <span className="visually-hidden"> (not completed)</span>}
      </li>
      <li className={payDone ? "checkout-step-bar is-done" : "checkout-step-bar"} aria-hidden="true" />
      <li className={payDone ? "is-current" : undefined} aria-current={payDone ? "step" : undefined}>
        <span className="checkout-step-dot">3</span>Done
      </li>
    </ol>
  )
}

export default CheckoutSteps
