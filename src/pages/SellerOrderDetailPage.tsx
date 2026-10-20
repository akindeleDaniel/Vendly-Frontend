import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import DeliveryAddressBlock from "../components/DeliveryAddressBlock"
import Notice from "../components/Notice"
import OrderItemList from "../components/OrderItemList"
import SellerFulfilmentPanel from "../components/SellerFulfilmentPanel"
import SellerOrderExtras from "../components/SellerOrderExtras"
import { describeOrderStatus, fetchSellerOrder, formatProvider } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { SellerOrder } from "../types/order"
import { formatNaira } from "../lib/money"

// One of the seller's paid orders: what to send, where to send it, and what they receive.
function SellerOrderDetailPage() {
    useDocumentTitle("Order")
    const { id = "" } = useParams()
    const [outcome, setOutcome] = useState<OrderOutcome<SellerOrder> | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        fetchSellerOrder(id, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [id, attempt])

    if (outcome === null) {
        return <p role="status">Loading order...</p>
    }

    if (outcome.kind !== "ok") {
        return (
            <div>
                <h1>Order</h1>
                {outcome.kind === "not-found" && <Notice kind="warning">We could not find this order.</Notice>}
                {outcome.kind === "unauthorized" && <Notice kind="warning">Your session has ended. Please log in again.</Notice>}
                {outcome.kind === "error" && (
                    <Notice kind="error">
                        <p>{outcome.message}</p>
                        <button type="button" onClick={() => { setOutcome(null); setAttempt((count) => count + 1) }}>Try again</button>
                    </Notice>
                )}
                <Link to="/seller/orders">Back to orders</Link>
            </div>
        )
    }

    const order = outcome.data
    return (
        <div>
            <h1>Order {order.id}</h1>
            <dl className="card status-list">
                <div><dt>Status</dt><dd><span className="badge">{describeOrderStatus(order, "seller")}</span></dd></div>
                <div><dt>Paid with</dt><dd>{formatProvider(order.provider)}</dd></div>
            </dl>

            <section aria-labelledby="progress-heading" className="card summary-card">
                <h2 id="progress-heading">Progress</h2>
                <SellerFulfilmentPanel
                    order={order}
                    onUpdated={(update) => setOutcome({ kind: "ok", data: { ...order, ...update } })}
                />
            </section>

            <section aria-labelledby="items-heading" className="card summary-card">
                <h2 id="items-heading">Items to send</h2>
                <OrderItemList items={order.items} />
            </section>

            <section aria-labelledby="ship-heading" className="card summary-card">
                <h2 id="ship-heading">Deliver to</h2>
                <DeliveryAddressBlock delivery={order.delivery} />
            </section>

            <section aria-labelledby="refunds-heading" className="card summary-card">
                <h2 id="refunds-heading">Refunds and complaints</h2>
                <SellerOrderExtras order={order} />
            </section>

            <section aria-labelledby="money-heading" className="card summary-card">
                <h2 id="money-heading">Payment</h2>
                <div className="summary-row"><span>Subtotal</span><span>{formatNaira(order.subtotal)}</span></div>
                <div className="summary-row"><span>Shipping</span><span>{formatNaira(order.shipping)}</span></div>
                <div className="summary-row"><span>Order total</span><span>{formatNaira(order.total)}</span></div>
                <div className="summary-row">
                    <span>{formatProvider(order.provider)} fee, VAT and stamp duty</span>
                    <span>{order.providerFee !== null ? `−${formatNaira(order.providerFee)}` : "Not reported yet"}</span>
                </div>
                <hr className="summary-divider" />
                <div className="summary-row summary-row-total">
                    <span>You receive</span>
                    <span className="summary-total-amount">{order.sellerReceives !== null ? formatNaira(order.sellerReceives) : "Not reported yet"}</span>
                </div>
                <p className="form-hint">The provider pays this to your payout account on its usual settlement schedule.</p>
            </section>

            <Link to="/seller/orders">Back to orders</Link>
        </div>
    )
}

export default SellerOrderDetailPage
