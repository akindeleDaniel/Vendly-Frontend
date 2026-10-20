import { Link } from "react-router-dom"
import DisputeBadge from "./DisputeBadge"
import RefundList from "./RefundList"
import { formatNaira } from "../lib/money"
import { hasAmount } from "../lib/orderApi"
import type { BuyerOrderExtras as BuyerExtras } from "../types/order"

type BuyerOrderExtrasProps = {
    checkoutId: number
    sellerOrder: { id: number, status: string } & BuyerExtras
    // In a list the refund details are left for the order page.
    compact?: boolean
}

// What a shopper can do about one seller's order beyond receiving it: see refunds made to them,
// follow a complaint, or report a problem.
function BuyerOrderExtras({ checkoutId, sellerOrder, compact }: BuyerOrderExtrasProps) {
    const { dispute, refunds, refundedAmount } = sellerOrder
    const canReport = dispute === null && (sellerOrder.status === "PAID" || sellerOrder.status === "SHIPPED" || sellerOrder.status === "DELIVERED")

    return (
        <div className="order-extras">
            {hasAmount(refundedAmount) && (
                <div className="summary-row"><span>Refunded to you</span><span>{formatNaira(refundedAmount)}</span></div>
            )}
            {!compact && <RefundList refunds={refunds} heading="Refunds" />}
            {dispute && (
                <p className="order-extras-line">
                    <Link to={`/disputes/${dispute.id}`}>Complaint {dispute.id}</Link>
                    <DisputeBadge dispute={dispute} viewer="buyer" />
                </p>
            )}
            {canReport && (
                <p className="order-extras-line">
                    <Link to={`/orders/${checkoutId}/seller-orders/${sellerOrder.id}/complaint`}>Report a problem with this order</Link>
                </p>
            )}
        </div>
    )
}

export default BuyerOrderExtras
