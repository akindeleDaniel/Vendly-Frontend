import { Link } from "react-router-dom"
import DisputeBadge from "./DisputeBadge"
import RefundList from "./RefundList"
import { formatNaira } from "../lib/money"
import { hasAmount } from "../lib/orderApi"
import type { SellerOrderExtras as SellerExtras } from "../types/order"

type SellerOrderExtrasProps = {
    order: { id: number, status: string } & SellerExtras
    // In a list the refund details are left for the order page.
    compact?: boolean
}

// What a seller sees about money going back on an order and any complaint about it, with a way to
// offer a refund.
function SellerOrderExtras({ order, compact }: SellerOrderExtrasProps) {
    const { dispute, refunds, refundedAmount, liabilityDeduction } = order
    const canOfferRefund = dispute === null && (order.status === "PAID" || order.status === "SHIPPED" || order.status === "DELIVERED")

    if (!dispute && !canOfferRefund && !hasAmount(refundedAmount) && !hasAmount(liabilityDeduction)) {
        return compact ? null : <p className="field-help">No refunds or complaints on this order.</p>
    }

    return (
        <div className="order-extras">
            {hasAmount(refundedAmount) && (
                <div className="summary-row"><span>Refunded to the buyer</span><span>{formatNaira(refundedAmount)}</span></div>
            )}
            {hasAmount(liabilityDeduction) && (
                <div className="summary-row">
                    <span>Kept by Vendly to recover refunds</span>
                    <span>−{formatNaira(liabilityDeduction)}</span>
                </div>
            )}
            {!compact && <RefundList refunds={refunds} heading="Refunds on this order" />}
            {dispute && (
                <p className="order-extras-line">
                    <Link to={`/seller/disputes/${dispute.id}`}>Complaint {dispute.id}</Link>
                    <DisputeBadge dispute={dispute} viewer="seller" />
                </p>
            )}
            {canOfferRefund && !compact && (
                <p className="order-extras-line">
                    <Link to={`/seller/orders/${order.id}/refund-offer`}>Offer the buyer a refund</Link>
                </p>
            )}
        </div>
    )
}

export default SellerOrderExtras
