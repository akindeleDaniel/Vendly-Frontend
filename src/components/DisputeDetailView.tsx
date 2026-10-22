import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import DisputeBadge from "./DisputeBadge"
import DisputeThread from "./DisputeThread"
import RefundList from "./RefundList"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import type { DisputeViewer } from "../lib/disputeApi"
import type { Dispute } from "../types/dispute"

type DisputeDetailViewProps = {
    dispute: Dispute
    viewer: DisputeViewer
    children?: ReactNode// the actions this person can take
}

// One complaint: what it is about, where it stands, the conversation and the refunds. The page
// adds the actions that fit the viewer (reply, respond, decide).
function DisputeDetailView({ dispute, viewer, children }: DisputeDetailViewProps) {
    const requested = dispute.requestedAmount
    const heading = dispute.openedBy === "SELLER" ? "Refund offer" : "Complaint"

    return (
        <div>
            <div className="order-header">
                <h1>{heading} {dispute.id}</h1>
                <DisputeBadge dispute={dispute} viewer={viewer} />
            </div>

            <section aria-labelledby="dispute-about-heading" className="card summary-card">
                <h2 id="dispute-about-heading">About this {dispute.openedBy === "SELLER" ? "offer" : "complaint"}</h2>
                <dl className="detail-list">
                    <div><dt>Reason</dt><dd>{dispute.reasonLabel}</dd></div>
                    <div><dt>Opened</dt><dd>{formatShortDate(dispute.createdAt)}</dd></div>
                    <div>
                        <dt>Order</dt>
                        <dd>
                            {viewer === "seller"
                                ? <Link to={`/seller/orders/${dispute.orderId}`}>Order {dispute.orderId}</Link>
                                : viewer === "buyer"
                                    ? <Link to={`/orders/${dispute.checkoutId}`}>View the order</Link>
                                    : <Link to={`/admin/orders/${dispute.orderId}`}>Order {dispute.orderId}</Link>}
                        </dd>
                    </div>
                    {viewer === "buyer" && dispute.seller && <div><dt>Seller</dt><dd>{dispute.seller.businessName}</dd></div>}
                    {viewer !== "buyer" && <div><dt>Buyer</dt><dd>{dispute.buyerName}</dd></div>}
                    {viewer === "admin" && dispute.buyer && <div><dt>Buyer email</dt><dd>{dispute.buyer.email}</dd></div>}
                    {viewer === "admin" && dispute.seller && <div><dt>Seller</dt><dd>{dispute.seller.businessName}</dd></div>}
                    {viewer === "admin" && dispute.sellerContact && <div><dt>Seller email</dt><dd>{dispute.sellerContact.email}</dd></div>}
                    <div><dt>Order total</dt><dd>{formatNaira(dispute.orderTotal)}</dd></div>
                    <div>
                        <dt>{dispute.openedBy === "SELLER" ? "Refund offered" : "Refund asked for"}</dt>
                        <dd>{requested ? formatNaira(requested) : "The full order"}</dd>
                    </div>
                    {dispute.approvedAmount && <div><dt>Refund approved</dt><dd>{formatNaira(dispute.approvedAmount)}</dd></div>}
                    {dispute.status === "OPEN" && dispute.responseDueAt && (
                        <div><dt>Seller should answer by</dt><dd>{formatShortDate(dispute.responseDueAt)}</dd></div>
                    )}
                    {dispute.resolvedAt && <div><dt>Closed</dt><dd>{formatShortDate(dispute.resolvedAt)}</dd></div>}
                </dl>
                <h3 className="order-section-title">Items in the order</h3>
                <ul className="order-lines">
                    {dispute.order.items.map((item) => (
                        <li key={item.title} className="order-line">
                            <div>
                                <p className="order-line-title">{item.title}</p>
                                <p className="order-line-meta">{formatNaira(item.unitPrice)} × {item.quantity}</p>
                            </div>
                            <span className="order-line-amount">{formatNaira(item.lineTotal)}</span>
                        </li>
                    ))}
                </ul>
                {dispute.decisionNote && (
                    <p className="stepper-shipping-note"><strong>Decision:</strong> {dispute.decisionNote}</p>
                )}
            </section>

            {dispute.refunds.length > 0 && (
                <section aria-label="Refunds for this complaint" className="card summary-card">
                    <RefundList refunds={dispute.refunds} />
                </section>
            )}

            <section aria-labelledby="dispute-thread-heading" className="card summary-card">
                <h2 id="dispute-thread-heading">Conversation</h2>
                <DisputeThread messages={dispute.messages} viewer={viewer} />
            </section>

            {children}
        </div>
    )
}

export default DisputeDetailView
