import type { ReactNode } from "react"
import { Check, ShoppingBag, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { formatMinorUnits, formatNaira, toMinorUnits } from "../lib/money"
import type { ProgressStep } from "../lib/buyerOrders"
import type { OrderItem } from "../types/order"

// Pieces shared by the shopper's pages: My orders, an order's own page, complaints and pre-orders.

// Paid, Shipped, Delivered as three dots joined by a line, with each step's date below.
export function OrderProgress({ steps, large = false }: { steps: ProgressStep[], large?: boolean }) {
    const stateWords = { done: "done", waiting: "in progress", next: "not yet", stopped: "stopped" }
    const summary = steps.map((step) => `${step.label}: ${step.detail || stateWords[step.state]}`).join(", ")

    return (
        <div className={`orders-steps${large ? " is-large" : ""}`} role="img" aria-label={summary}>
            <div className="orders-steps-track">
                {steps.map((step, index) => (
                    <span key={step.label} className="orders-steps-part">
                        {index > 0 && <span className={`orders-steps-line${step.state !== "next" ? " is-done" : ""}`} />}
                        <span className={`orders-steps-dot is-${step.state}`}>
                            {step.state === "done" && <Check size={large ? 14 : 12} strokeWidth={3.2} aria-hidden="true" />}
                            {step.state === "stopped" && <X size={large ? 14 : 12} strokeWidth={3.2} aria-hidden="true" />}
                        </span>
                    </span>
                ))}
            </div>
            <div className="orders-steps-labels" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                {steps.map((step) => (
                    <span key={step.label}><b>{step.label}</b>{step.detail}</span>
                ))}
            </div>
        </div>
    )
}

// An order, complaint or pre-order line. Pre-order lines have no line total, so it is worked out.
type ItemLine = Pick<OrderItem, "title" | "quantity" | "unitPrice" | "imageUrl" | "optionLabel" | "sizeLabel" | "productTitle"> & { lineTotal?: string }

function itemTitle(item: ItemLine): string {
    const option = [item.optionLabel, item.sizeLabel].filter(Boolean).join(", ")
    return `${item.productTitle ?? item.title}${option ? ` (${option})` : ""}`
}

// One line of an order: the photo, the product with its options and quantity, and the line total.
export function OrderItemRow({ item }: { item: ItemLine }) {
    const lineTotal = item.lineTotal ? formatNaira(item.lineTotal) : formatMinorUnits(toMinorUnits(Number(item.unitPrice)) * item.quantity)
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
                <span className="orders-item-title">{itemTitle(item)}</span>
                <span className="orders-item-details">{details}</span>
            </div>
            <span className="orders-item-price">{lineTotal}</span>
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
