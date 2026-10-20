import type { OrderItem } from "../types/order"
import { formatNaira } from "../lib/money"

// The items of an order, each with its price at checkout, unit price × quantity, and line total.
function OrderItemList({ items }: { items: OrderItem[] }) {
    return (
        <ul className="order-lines">
            {items.map((item) => (
                <li key={item.listingId} className="order-line">
                    <div>
                        <p className="order-line-title">{item.title}</p>
                        <p className="order-line-meta">{formatNaira(item.unitPrice)} × {item.quantity}</p>
                    </div>
                    <span className="order-line-amount">{formatNaira(item.lineTotal)}</span>
                </li>
            ))}
        </ul>
    )
}

export default OrderItemList
