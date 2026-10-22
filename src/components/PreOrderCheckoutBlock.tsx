import Notice from "./Notice"
import PreOrderRequestForm from "./PreOrderRequestForm"
import { formatShortDate } from "../lib/orderApi"
import type { ReviewSeller } from "../types/checkout"

type PreOrderCheckoutBlockProps = {
    group: ReviewSeller
    onCheckAgain: () => void
    isRefreshing: boolean
}

// What checkout says about a food shop that takes pre-orders: the approved request that this payment
// will use, or how to ask for one. A shop that only takes pre-orders cannot be paid until it approves.
function PreOrderCheckoutBlock({ group, onCheckAgain, isRefreshing }: PreOrderCheckoutBlockProps) {
    const { orderType, preOrder, seller } = group

    if (!orderType || orderType === "NOW" || !preOrder) {
        return null
    }

    if (preOrder.approved) {
        return (
            <Notice kind="success">
                <p>
                    Pre-order approved: {seller.businessName} will have this ready on {formatShortDate(preOrder.approved.readyAt)}.
                    {preOrder.approved.payBy && <> Pay by {formatShortDate(preOrder.approved.payBy)}.</>}
                </p>
                {orderType === "BOTH" && <p className="field-help">To order for delivery now instead, cancel the request from your pre-orders.</p>}
            </Notice>
        )
    }

    return (
        <div className="preorder-block">
            {preOrder.required && (
                <Notice kind="warning">
                    {seller.businessName} only takes pre-orders. Ask for a time below. When the shop approves, come back and press "Check again", then pay.
                </Notice>
            )}
            <PreOrderRequestForm sellerSlug={seller.slug} businessName={seller.businessName} optional={!preOrder.required} />
            {preOrder.required && (
                <button type="button" onClick={onCheckAgain} disabled={isRefreshing}>{isRefreshing ? "Checking..." : "Check again"}</button>
            )}
        </div>
    )
}

export default PreOrderCheckoutBlock
