import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { formatRefundStatus } from "../lib/refundLabels"

type RefundLine = {
    reference: string
    amount: string
    status: string
    note?: string | null// shown to the buyer
    reason?: string | null// shown to the seller and administrators
    expectedAt?: string | null
    createdAt: string
    completedAt: string | null
}

// The refunds on an order or a complaint: how much, where each one stands, and any note with it.
function RefundList({ refunds, heading = "Refunds" }: { refunds: RefundLine[], heading?: string }) {
    if (refunds.length === 0) {
        return null
    }

    return (
        <div className="refund-list">
            <h3 className="order-section-title">{heading}</h3>
            <ul>
                {refunds.map((refund) => (
                    <li key={refund.reference}>
                        <div className="refund-line">
                            <span className="order-line-title">{formatNaira(refund.amount)}</span>
                            <span className={refund.status === "FAILED" || refund.status === "NEEDS_ATTENTION" ? "badge badge-warning" : "badge"}>
                                {formatRefundStatus(refund.status)}
                            </span>
                        </div>
                        <p className="order-line-meta">
                            {refund.completedAt
                                ? `Completed ${formatShortDate(refund.completedAt)}`
                                : refund.expectedAt
                                    ? `Expected by ${formatShortDate(refund.expectedAt)}`
                                    : `Started ${formatShortDate(refund.createdAt)}`}
                        </p>
                        {(refund.note || refund.reason) && <p className="refund-note">{refund.note ?? refund.reason}</p>}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default RefundList
