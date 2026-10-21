import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import BackArrow from "../components/BackArrow"
import DeliveryAddressBlock from "../components/DeliveryAddressBlock"
import Notice from "../components/Notice"
import OrderItemList from "../components/OrderItemList"
import SellerFulfilmentPanel from "../components/SellerFulfilmentPanel"
import SellerOrderExtras from "../components/SellerOrderExtras"
import type { FulfilmentUpdate } from "../components/SellerFulfilmentPanel"
import { describeOrderStatus, fetchSellerOrders, formatDate, formatProvider } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { OrderPage, SellerOrderSummary } from "../types/order"
import { formatNaira } from "../lib/money"

const statusFilters = [
    { value: "", label: "All" },
    { value: "PAID", label: "Paid" },
    { value: "SHIPPED", label: "Shipped" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "REFUNDED", label: "Refunded" }
]

// The seller's paid orders, newest first: what was bought, where it goes, and the fee the payment
// provider took from each.
function SellerOrdersPage() {
    useDocumentTitle("Orders")
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState("")
    const [outcome, setOutcome] = useState<OrderOutcome<OrderPage<SellerOrderSummary>> | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        fetchSellerOrders(page, status, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [page, status, attempt])

    // Applies one order's new status and dates to the list, leaving the other orders as they are.
    function applyUpdate(orderId: number, update: FulfilmentUpdate) {
        setOutcome((current) => current?.kind === "ok"
            ? {
                kind: "ok",
                data: {
                    ...current.data,
                    orders: current.data.orders.map((order) => order.id === orderId ? { ...order, ...update } : order)
                }
            }
            : current)
    }

    function changeStatus(next: string) {
        setOutcome(null)
        setStatus(next)
        setPage(1)
    }

    return (
        <div>
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <h1>Orders</h1>
            <p>Your paid orders. Fees are what the payment provider deducted from your share before paying you.</p>

            <label className="field-inline">
                Show{" "}
                <select value={status} onChange={(event) => changeStatus(event.target.value)}>
                    {statusFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
            </label>

            {outcome === null && <p role="status">Loading orders...</p>}
            {outcome?.kind === "unauthorized" && (
                <Notice kind="warning">Your session has ended. Please log in again to see your orders.</Notice>
            )}
            {outcome?.kind === "not-found" && (
                <Notice kind="error">We could not load your orders. Please try again.</Notice>
            )}
            {outcome?.kind === "error" && (
                <Notice kind="error">
                    <p>{outcome.message}</p>
                    <button type="button" onClick={() => { setOutcome(null); setAttempt((count) => count + 1) }}>Retry</button>
                </Notice>
            )}
            {outcome?.kind === "ok" && (
                <>
                    {outcome.data.orders.length === 0 ? (
                        <p>No orders here yet.</p>
                    ) : (
                        <ul className="order-history">
                            {outcome.data.orders.map((order) => (
                                <li key={order.id} className="card order-card">
                                    <div className="order-header">
                                        <h2><Link to={`/seller/orders/${order.id}`}>Order {order.id}</Link></h2>
                                        <span className="badge">{describeOrderStatus(order, "seller")}</span>
                                    </div>
                                    <p className="order-line-meta">
                                        {formatDate(order.paidAt ?? order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                                    </p>
                                    <SellerFulfilmentPanel order={order} onUpdated={(update) => applyUpdate(order.id, update)} />
                                    <div className="order-columns">
                                        <section aria-label={`Items in order ${order.id}`}>
                                            <h3 className="order-section-title">What was bought</h3>
                                            <OrderItemList items={order.items} />
                                        </section>
                                        <section aria-label={`Delivery address for order ${order.id}`}>
                                            <h3 className="order-section-title">Deliver to</h3>
                                            <DeliveryAddressBlock delivery={order.delivery} />
                                        </section>
                                    </div>
                                    <SellerOrderExtras order={order} compact />
                                    <div className="order-money">
                                        <div className="summary-row"><span>Order total</span><span>{formatNaira(order.total)}</span></div>
                                        <div className="summary-row">
                                            <span>{formatProvider(order.provider)} fee</span>
                                            <span>{order.providerFee !== null ? `−${formatNaira(order.providerFee)}` : "Not reported yet"}</span>
                                        </div>
                                        <div className="summary-row summary-row-total">
                                            <span>You receive</span>
                                            <span>{order.sellerReceives !== null ? formatNaira(order.sellerReceives) : "Not reported yet"}</span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {outcome.data.total > outcome.data.pageSize && (
                        <div className="action-row">
                            <button type="button" onClick={() => { setOutcome(null); setPage(page - 1) }} disabled={page <= 1}>Previous</button>
                            <span>Page {page} of {Math.ceil(outcome.data.total / outcome.data.pageSize)}</span>
                            <button type="button" onClick={() => { setOutcome(null); setPage(page + 1) }} disabled={page * outcome.data.pageSize >= outcome.data.total}>Next</button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default SellerOrdersPage
