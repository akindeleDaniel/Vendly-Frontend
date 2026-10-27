import type { ReactNode } from "react"
import { Check, ShoppingBag } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatNaira } from "../lib/money"
import type { ProgressStep } from "../lib/buyerOrders"
import type { OrderItem } from "../types/order"

// Pieces shared by the shopper's order pages: My orders and an order's own page.

// Paid, Shipped, Delivered as three dots joined by a line, with each step's date below.
export function OrderProgress({ steps, large = false }: { steps: ProgressStep[], large?: boolean }) {
    const summary = steps
        .map((step) => `${step.label} ${step.state === "done" ? "done" : step.state === "waiting" ? "waiting for you" : "not yet"}`)
        .join(", ")

    return (
        <div className={`orders-steps${large ? " is-large" : ""}`} role="img" aria-label={summary}>
            <div className="orders-steps-track">
                {steps.map((step, index) => (
                    <span key={step.label} className="orders-steps-part">
                        {index > 0 && <span className={`orders-steps-line${step.state !== "next" ? " is-done" : ""}`} />}
                        <span className={`orders-steps-dot is-${step.state}`}>
                            {step.state === "done" && <Check size={large ? 14 : 12} strokeWidth={3.2} aria-hidden="true" />}
                        </span>
                    </span>
                ))}
            </div>
            <div className="orders-steps-labels">
                {steps.map((step) => (
                    <span key={step.label}><b>{step.label}</b>{step.detail}</span>
                ))}
            </div>
        </div>
    )
}

// One line of an order: the photo, the product with its options and quantity, and the line total.
export function OrderItemRow({ item }: { item: OrderItem }) {
    const details = [
        item.optionLabel,
        item.sizeLabel,
        `Qty ${item.quantity}`,
        item.quantity > 1 ? `${formatNaira(item.unitPrice)} each` : null
    ].filter(Boolean).join(" · ")

    return (
        <li className="orders-item">
            {item.imageUrl
                ? <img className="orders-item-photo" src={item.imageUrl} alt="" loading="lazy" />
                : <span className="orders-item-photo" aria-hidden="true"><ShoppingBag size={22} /></span>}
            <div className="orders-item-text">
                <span className="orders-item-title">{item.productTitle ?? item.title}</span>
                <span className="orders-item-details">{details}</span>
            </div>
            <span className="orders-item-price">{formatNaira(item.lineTotal)}</span>
        </li>
    )
}

// A short line about the order: the shop's shipping note, a pre-order date, a complaint or a refund.
export function OrderNote({ icon: Icon, tone, children }: { icon: LucideIcon, tone: "plain" | "warning" | "good", children: ReactNode }) {
    return (
        <div className={`orders-note is-${tone}`}>
            <Icon size={18} aria-hidden="true" />
            <div className="orders-note-text">{children}</div>
        </div>
    )
}
