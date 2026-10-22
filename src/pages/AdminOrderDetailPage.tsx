import { Link, useParams } from "react-router-dom"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { fetchAdminOrder } from "../lib/adminLookupApi"
import { formatNaira } from "../lib/money"
import { formatOrderStatus, formatProvider, formatShortDate, hasAmount } from "../lib/orderApi"
import { formatRefundStatus } from "../lib/refundLabels"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

// Everything about one order for an administrator: who bought and sold it, where it goes, the money,
// the payments behind it, and any refunds or complaints.
function AdminOrderDetailPage() {
    useDocumentTitle("Order")
    const { id = "" } = useParams()
    const { state, reload } = useApiResource(id, (signal) => fetchAdminOrder(id, signal))
    const back = <BackArrow to="/admin/orders" label="Back to the order search" />

    if (state.kind === "loading") {
        return <p role="status">Loading the order...</p>
    }

    if (state.kind === "error") {
        return (
            <div>
                {back}
                <h1>Order</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { order } = state.data
    const { fulfilment } = order

    return (
        <div>
            {back}
            <div className="order-header">
                <h1>Order {order.id}</h1>
                <span className="badge">{formatOrderStatus(order.status)}</span>
            </div>
            <p className="order-line-meta">Checkout {order.checkoutId} ({order.checkoutStatus.toLowerCase()}) · {formatShortDate(order.createdAt)}</p>

            <div className="action-row">
                <Link to={`/admin/refunds?order=${order.id}`} className="btn btn-primary">Issue a refund</Link>
            </div>

            <section aria-labelledby="people-heading" className="card summary-card">
                <h2 id="people-heading">People</h2>
                <dl className="detail-list">
                    <div><dt>Buyer</dt><dd><Link to={`/admin/users/${order.buyer.id}`}>{order.buyer.name}</Link>, {order.buyer.email}</dd></div>
                    <div>
                        <dt>Seller</dt>
                        <dd><Link to={`/admin/users/${order.seller.id}`}>{order.seller.businessName ?? "No shop"}</Link>, {order.seller.email}</dd>
                    </div>
                </dl>
            </section>

            <section aria-labelledby="items-heading" className="card summary-card">
                <h2 id="items-heading">Items</h2>
                <ul className="order-lines">
                    {order.items.map((item) => (
                        <li key={item.listingId} className="order-line">
                            <div>
                                <p className="order-line-title">{item.title}</p>
                                <p className="order-line-meta">{formatNaira(item.unitPrice)} × {item.quantity}</p>
                            </div>
                            <span className="order-line-amount">{formatNaira(item.lineTotal)}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="money-heading" className="card summary-card">
                <h2 id="money-heading">Money</h2>
                <div className="summary-row"><span>Subtotal</span><span>{formatNaira(order.subtotal)}</span></div>
                <div className="summary-row"><span>Shipping</span><span>{formatNaira(order.shippingCost)}</span></div>
                <div className="summary-row summary-row-total"><span>Total</span><span>{formatNaira(order.total)}</span></div>
                <hr className="summary-divider" />
                <div className="summary-row"><span>Provider fee</span><span>{order.providerFee !== null ? formatNaira(order.providerFee) : "Not reported"}</span></div>
                <div className="summary-row"><span>Seller receives</span><span>{order.sellerReceives !== null ? formatNaira(order.sellerReceives) : "Not reported"}</span></div>
                {hasAmount(order.refundedAmount) && <div className="summary-row"><span>Refunded</span><span>{formatNaira(order.refundedAmount)}</span></div>}
                {hasAmount(order.liabilityDeduction) && <div className="summary-row"><span>Kept to recover refunds</span><span>{formatNaira(order.liabilityDeduction)}</span></div>}
            </section>

            <section aria-labelledby="delivery-heading" className="card summary-card">
                <h2 id="delivery-heading">Delivery</h2>
                <dl className="detail-list">
                    <div><dt>To</dt><dd>{order.delivery.name}, {order.delivery.phone}</dd></div>
                    <div><dt>Address</dt><dd>{order.delivery.address}, {order.delivery.lga}, {order.delivery.state}</dd></div>
                    {order.delivery.instructions && <div><dt>Instructions</dt><dd>{order.delivery.instructions}</dd></div>}
                    <div><dt>Shipped</dt><dd>{fulfilment.shippedAt ? formatShortDate(fulfilment.shippedAt) : "Not yet"}</dd></div>
                    {fulfilment.shippingNote && <div><dt>Shipping note</dt><dd>{fulfilment.shippingNote}</dd></div>}
                    <div><dt>Seller reported delivered</dt><dd>{fulfilment.deliveryReportedAt ? formatShortDate(fulfilment.deliveryReportedAt) : "Not yet"}</dd></div>
                    <div><dt>Buyer confirmed</dt><dd>{fulfilment.deliveryConfirmedAt ? formatShortDate(fulfilment.deliveryConfirmedAt) : "Not yet"}</dd></div>
                </dl>
            </section>

            <section aria-labelledby="payments-heading" className="card summary-card">
                <h2 id="payments-heading">Payments</h2>
                {order.payments.length === 0 ? <p>No payment attempts.</p> : (
                    <ul className="order-lines">
                        {order.payments.map((payment) => (
                            <li key={payment.id}>
                                <dl className="detail-list">
                                    <div><dt>{formatProvider(payment.provider)}</dt><dd>{formatNaira(payment.amount)}, {payment.status.toLowerCase()}</dd></div>
                                    <div><dt>Reference</dt><dd>{payment.reference}</dd></div>
                                    {payment.providerReference && <div><dt>Provider reference</dt><dd>{payment.providerReference}</dd></div>}
                                    {payment.providerStatus && <div><dt>Provider says</dt><dd>{payment.providerStatus}</dd></div>}
                                    {payment.failureReason && <div><dt>Why it failed</dt><dd>{payment.failureReason}</dd></div>}
                                    {payment.verifiedAt && <div><dt>Confirmed</dt><dd>{formatShortDate(payment.verifiedAt)}</dd></div>}
                                    {payment.recoveryCase && (
                                        <div><dt>Recovery case</dt><dd><Link to="/admin/recovery-cases">Case {payment.recoveryCase.id}</Link> ({payment.recoveryCase.status.toLowerCase()}): {payment.recoveryCase.reason}</dd></div>
                                    )}
                                </dl>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby="refunds-heading" className="card summary-card">
                <h2 id="refunds-heading">Refunds</h2>
                {order.refunds.length === 0 ? <p>No refunds.</p> : (
                    <ul className="deduction-list">
                        {order.refunds.map((refund) => (
                            <li key={refund.id}>
                                <span>{formatShortDate(refund.createdAt)} · {refund.reason}</span>
                                <strong>{formatNaira(refund.amount)}, {formatRefundStatus(refund.status).toLowerCase()}</strong>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby="complaints-heading" className="card summary-card">
                <h2 id="complaints-heading">Complaints</h2>
                {order.complaints.length === 0 ? <p>No complaints.</p> : (
                    <ul className="deduction-list">
                        {order.complaints.map((complaint) => (
                            <li key={complaint.id}>
                                <span><Link to={`/admin/complaints/${complaint.id}`}>Complaint {complaint.id}</Link> · {formatShortDate(complaint.createdAt)}</span>
                                <strong>{complaint.status.toLowerCase().replace("_", " ")}</strong>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

export default AdminOrderDetailPage
