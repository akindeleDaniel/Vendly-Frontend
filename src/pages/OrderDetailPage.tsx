import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import BuyerOrderExtras from "../components/BuyerOrderExtras"
import BackArrow from "../components/BackArrow"
import ConfirmReceiptPrompt from "../components/ConfirmReceiptPrompt"
import FulfilmentTimeline from "../components/FulfilmentTimeline"
import Notice from "../components/Notice"
import OrderItemList from "../components/OrderItemList"
import OrderReviewsPanel from "../components/OrderReviewsPanel"
import { describeOrderStatus, fetchMyOrder, formatDate, formatOrderStatus, formatProvider } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { CustomerOrder } from "../types/order"
import { formatNaira } from "../lib/money"

// One of the shopper's paid orders, with each seller's items and the delivery address.
function OrderDetailPage() {
    useDocumentTitle("Order")
    const { id = "" } = useParams()
    const reviewOrderId = useSearchParams()[0].get("review")// set by the "Write a review" button on the orders list
    const [outcome, setOutcome] = useState<OrderOutcome<CustomerOrder> | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        fetchMyOrder(id, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [id])

    if (outcome === null) {
        return <p role="status">Loading your order...</p>
    }

    if (outcome.kind !== "ok") {
        return (
            <div>
                <BackArrow to="/orders" label="Back to my orders" />
                <h1>Order</h1>
                {outcome.kind === "not-found" && <Notice kind="warning">We could not find this order.</Notice>}
                {outcome.kind === "error" && <Notice kind="error">{outcome.message}</Notice>}
            </div>
        )
    }

    const order = outcome.data

    return (
        <div>
            <BackArrow to="/orders" label="Back to my orders" />
            <h1>Order {order.id}</h1>
            <dl className="card status-list">
                <div><dt>Status</dt><dd><span className="badge">{formatOrderStatus(order.status)}</span></dd></div>
                <div><dt>Paid</dt><dd>{formatDate(order.payment?.paidAt ?? null)}</dd></div>
                <div><dt>Paid with</dt><dd>{formatProvider(order.payment?.provider)}</dd></div>
                <div><dt>Payment reference</dt><dd>{order.payment?.reference ?? "—"}</dd></div>
            </dl>

            {order.sellerOrders.map((sellerOrder) => (
                <article key={sellerOrder.id} className="card summary-card">
                    <div className="order-header">
                        <h2>
                            {sellerOrder.seller
                                ? <Link to={`/shop/${encodeURIComponent(sellerOrder.seller.slug)}`}>{sellerOrder.seller.businessName}</Link>
                                : "Seller"}
                        </h2>
                        <span className="badge">{describeOrderStatus(sellerOrder, "buyer")}</span>
                    </div>
                    <FulfilmentTimeline status={sellerOrder.status} paidAt={order.payment?.paidAt ?? null} fulfilment={sellerOrder} viewer="buyer" />
                    {sellerOrder.status === "SHIPPED" && sellerOrder.deliveryReportedAt !== null && (
                        <ConfirmReceiptPrompt
                            checkoutId={order.id}
                            sellerOrderId={sellerOrder.id}
                            shopName={sellerOrder.seller?.businessName}
                            reportedAt={sellerOrder.deliveryReportedAt}
                            onConfirmed={(updated) => setOutcome({ kind: "ok", data: updated })}
                        />
                    )}
                    {sellerOrder.status === "DELIVERED" && <OrderReviewsPanel checkoutId={order.id} sellerOrderId={sellerOrder.id} startOpen={reviewOrderId === String(sellerOrder.id)} />}
                    <OrderItemList items={sellerOrder.items} />
                    <hr className="summary-divider" />
                    <div className="summary-row"><span>Subtotal</span><span>{formatNaira(sellerOrder.subtotal)}</span></div>
                    <div className="summary-row"><span>Shipping</span><span>{formatNaira(sellerOrder.shipping)}</span></div>
                    <div className="summary-row summary-row-total"><span>Seller total</span><span>{formatNaira(sellerOrder.total)}</span></div>
                    <BuyerOrderExtras checkoutId={order.id} sellerOrder={sellerOrder} />
                </article>
            ))}

            <div className="card summary-card">
                <div className="summary-row summary-row-total">
                    <span>Total paid</span>
                    <span className="summary-total-amount">{formatNaira(order.total)}</span>
                </div>
            </div>

            <section aria-labelledby="delivery-heading" className="card summary-card">
                <h2 id="delivery-heading">Delivery</h2>
                <p>{order.delivery.fullName}, {order.delivery.phone}</p>
                <p>{order.delivery.address}, {order.delivery.lga}, {order.delivery.state}</p>
                {order.delivery.instructions && <p>Instructions: {order.delivery.instructions}</p>}
            </section>

        </div>
    )
}

export default OrderDetailPage
