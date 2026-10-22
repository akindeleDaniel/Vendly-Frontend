import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import BuyerOrderExtras from "../components/BuyerOrderExtras"
import BackArrow from "../components/BackArrow"
import ConfirmReceiptPrompt from "../components/ConfirmReceiptPrompt"
import FulfilmentTimeline from "../components/FulfilmentTimeline"
import Notice from "../components/Notice"
import OrderItemList from "../components/OrderItemList"
import { describeOrderStatus, fetchMyOrders, formatDate, formatOrderStatus, formatProvider } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { CustomerOrder, CustomerOrderSummary, OrderPage } from "../types/order"
import { formatNaira } from "../lib/money"

// The shopper's paid orders, newest first.
function MyOrdersPage() {
    useDocumentTitle("My orders")
    const [page, setPage] = useState(1)
    const [outcome, setOutcome] = useState<OrderOutcome<OrderPage<CustomerOrderSummary>> | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        fetchMyOrders(page, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [page, attempt])

    // Applies a confirmation to the list: the seller orders in the updated checkout replace their
    // old versions, and every other order stays as it was.
    function applyConfirmation(updated: CustomerOrder) {
        setOutcome((current) => current?.kind === "ok"
            ? {
                kind: "ok",
                data: {
                    ...current.data,
                    orders: current.data.orders.map((order) => order.id !== updated.id
                        ? order
                        : {
                            ...order,
                            sellerOrders: order.sellerOrders.map((sellerOrder) => {
                                const fresh = updated.sellerOrders.find((candidate) => candidate.id === sellerOrder.id)
                                return fresh
                                    ? {
                                        ...sellerOrder,
                                        status: fresh.status,
                                        shippedAt: fresh.shippedAt,
                                        shippingNote: fresh.shippingNote,
                                        deliveryReportedAt: fresh.deliveryReportedAt,
                                        deliveryConfirmedAt: fresh.deliveryConfirmedAt,
                                        deliveryAutoClosedAt: fresh.deliveryAutoClosedAt
                                    }
                                    : sellerOrder
                            })
                        })
                }
            }
            : current)
    }

    if (outcome === null) {
        return <p role="status">Loading your orders...</p>
    }

    if (outcome.kind !== "ok") {
        return (
            <div>
                <BackArrow to="/" label="Back to the home page" />
                <h1>My orders</h1>
                {outcome.kind === "error" && (
                    <Notice kind="error">
                        <p>{outcome.message}</p>
                        <button type="button" onClick={() => { setOutcome(null); setAttempt((count) => count + 1) }}>Retry</button>
                    </Notice>
                )}
            </div>
        )
    }

    const { orders, total, pageSize } = outcome.data
    const lastPage = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div>
            <BackArrow to="/" label="Back to the home page" />
            <h1>My orders</h1>
            <p className="page-links">
                <Link to="/disputes">Your complaints</Link>
            </p>
            {orders.length === 0 ? (
                <>
                    <p>You have no paid orders yet.</p>
                    <Link to="/" className="btn btn-primary">Start shopping</Link>
                </>
            ) : (
                <ul className="order-history">
                    {orders.map((order) => (
                        <li key={order.id} className="card summary-card">
                            <div className="order-header">
                                <h2><Link to={`/orders/${order.id}`}>Order {order.id}</Link></h2>
                                <span className="badge">{formatOrderStatus(order.status)}</span>
                            </div>
                            <p className="order-line-meta">
                                {formatDate(order.payment?.paidAt ?? order.createdAt)} · Paid with {formatProvider(order.payment?.provider)}
                            </p>
                            {order.sellerOrders.map((sellerOrder) => (
                                <div key={sellerOrder.id} className="order-seller">
                                    <div className="order-line">
                                        <span className="order-line-title">
                                            {sellerOrder.seller?.businessName ?? "Seller"} · {describeOrderStatus(sellerOrder, "buyer")}
                                        </span>
                                        <span className="order-line-amount">{formatNaira(sellerOrder.total)}</span>
                                    </div>
                                    <FulfilmentTimeline status={sellerOrder.status} paidAt={order.payment?.paidAt ?? null} fulfilment={sellerOrder} viewer="buyer" />
                                    {sellerOrder.status === "SHIPPED" && sellerOrder.deliveryReportedAt !== null && (
                                        <ConfirmReceiptPrompt checkoutId={order.id} sellerOrderId={sellerOrder.id} onConfirmed={applyConfirmation} />
                                    )}
                                    {sellerOrder.status === "DELIVERED" && (
                                        <Link to={`/orders/${order.id}?review=${sellerOrder.id}`} className="btn btn-primary">Write a review</Link>
                                    )}
                                    <OrderItemList items={sellerOrder.items} />
                                    <BuyerOrderExtras checkoutId={order.id} sellerOrder={sellerOrder} compact />
                                </div>
                            ))}
                            <div className="summary-row summary-row-total"><span>Total</span><span>{formatNaira(order.total)}</span></div>
                        </li>
                    ))}
                </ul>
            )}
            {lastPage > 1 && (
                <div className="action-row">
                    <button type="button" onClick={() => { setOutcome(null); setPage(page - 1) }} disabled={page <= 1}>Previous</button>
                    <span>Page {page} of {lastPage}</span>
                    <button type="button" onClick={() => { setOutcome(null); setPage(page + 1) }} disabled={page >= lastPage}>Next</button>
                </div>
            )}
        </div>
    )
}

export default MyOrdersPage
