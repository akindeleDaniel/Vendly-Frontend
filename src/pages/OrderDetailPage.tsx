import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, CalendarDays, RotateCcw, Truck } from "lucide-react"
import { OrderItemRow, OrderNote, OrderProgress } from "../components/BuyerOrderParts"
import ConfirmReceiptPrompt from "../components/ConfirmReceiptPrompt"
import Notice from "../components/Notice"
import OrderReviewsPanel from "../components/OrderReviewsPanel"
import ShopAvatar from "../components/ShopAvatar"
import { SHORT_COMPLAINT_REASONS, buyerProgressSteps, describeBuyerStatus, formatOrderDay, hasProgress } from "../lib/buyerOrders"
import { describeDispute } from "../lib/disputeApi"
import { formatMinorUnits, formatNaira, toMinorUnits } from "../lib/money"
import { fetchMyOrder, formatProvider, hasAmount } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { CustomerOrder } from "../types/order"

type SellerOrder = CustomerOrder["sellerOrders"][number]

// Adds money strings from the server ("18000.00") in whole kobo, so the sums are exact.
function sumOf(amounts: string[]): number {
    return amounts.reduce((total, amount) => total + toMinorUnits(Number(amount)), 0)
}

// An open complaint, or how one was settled, with a link to follow it.
function ComplaintCard({ sellerOrder }: { sellerOrder: SellerOrder }) {
    const dispute = sellerOrder.dispute

    if (!dispute) {
        return null
    }

    const shopName = sellerOrder.seller?.businessName ?? "The shop"
    const { label } = describeDispute(dispute, "buyer")

    return (
        <div className="order-complaint">
            <div className="order-complaint-head">
                <AlertTriangle size={18} aria-hidden="true" />
                <b>Complaint: {SHORT_COMPLAINT_REASONS[dispute.reason] ?? SHORT_COMPLAINT_REASONS.OTHER}</b>
                <span className="order-complaint-status">{label}</span>
            </div>
            {dispute.status === "OPEN" && (
                <p>
                    {dispute.requestedAmount && hasAmount(dispute.requestedAmount) ? `You asked for a refund of ${formatNaira(dispute.requestedAmount)}` : "You opened it"}
                    {dispute.createdAt ? ` on ${formatOrderDay(dispute.createdAt)}` : ""}.
                    {dispute.responseDueAt ? ` ${shopName} has until ${formatOrderDay(dispute.responseDueAt, { time: true })} to reply. If they don't, StoreHatch reviews it.` : ""}
                </p>
            )}
            <div><Link to={`/disputes/${dispute.id}`} className="btn">View complaint</Link></div>
        </div>
    )
}

type ShopSectionProps = {
    order: CustomerOrder
    sellerOrder: SellerOrder
    openReview: boolean
    onConfirmed: (order: CustomerOrder) => void
}

// One shop's part of the order: its progress, what to do next, the items and what was paid to the shop.
function ShopSection({ order, sellerOrder, openReview, onConfirmed }: ShopSectionProps) {
    const shop = sellerOrder.seller
    const shopName = shop?.businessName ?? "Shop"
    const status = describeBuyerStatus(sellerOrder)
    const showsProgress = hasProgress(sellerOrder)
    const needsConfirm = sellerOrder.status === "SHIPPED" && sellerOrder.deliveryReportedAt !== null
    const isDelivered = sellerOrder.status === "DELIVERED"
    const canReport = sellerOrder.dispute === null && showsProgress

    return (
        <article className="order-shop" aria-label={`${shopName}: ${status.label}`}>
            <div className="order-shop-head">
                <ShopAvatar name={shopName} logoUrl={shop?.logoUrl} brandColor={shop?.brandColor} />
                <div className="order-shop-name">
                    {shop ? <Link to={`/shop/${encodeURIComponent(shop.slug)}`}>{shop.businessName}</Link> : <b>{shopName}</b>}
                    {shop?.location && <span>{shop.location}</span>}
                </div>
                <span className={`orders-status is-${status.tone}`}>{status.label}</span>
            </div>

            {showsProgress && <OrderProgress steps={buyerProgressSteps(sellerOrder, order.payment?.paidAt ?? order.createdAt, true)} large />}

            {needsConfirm && (
                <ConfirmReceiptPrompt
                    checkoutId={order.id}
                    sellerOrderId={sellerOrder.id}
                    shopName={shopName}
                    reportedAt={sellerOrder.deliveryReportedAt}
                    canReport={canReport}
                    onConfirmed={onConfirmed}
                />
            )}

            {sellerOrder.status === "PAID" && sellerOrder.fulfilmentType === "PRE_ORDER" && sellerOrder.readyAt && (
                <OrderNote icon={CalendarDays} tone="plain">Pre-order: the shop will have it ready on {formatOrderDay(sellerOrder.readyAt, { time: true })}.</OrderNote>
            )}

            {sellerOrder.shippingNote && !isDelivered && (
                <OrderNote icon={Truck} tone="plain">From the shop: {sellerOrder.shippingNote}</OrderNote>
            )}

            <ComplaintCard sellerOrder={sellerOrder} />

            {sellerOrder.refunds.map((refund) => (
                <OrderNote key={refund.reference} icon={RotateCcw} tone={refund.status === "SUCCEEDED" ? "good" : "plain"}>
                    {refund.status === "SUCCEEDED"
                        ? `Refund of ${formatNaira(refund.amount)} completed${refund.completedAt ? ` on ${formatOrderDay(refund.completedAt)}` : ""}.`
                        : refund.status === "PENDING" || refund.status === "PROCESSING"
                            ? `Refund of ${formatNaira(refund.amount)} on its way${refund.expectedAt ? `, expected by ${formatOrderDay(refund.expectedAt)}` : ""}.`
                            : `Refund of ${formatNaira(refund.amount)}: StoreHatch is sorting this out and will keep you posted.`}
                    {refund.note && ` ${refund.note}`}
                </OrderNote>
            ))}

            <ul className="orders-items">
                {sellerOrder.items.map((item, index) => <OrderItemRow key={`${item.listingId}-${index}`} item={item} />)}
            </ul>

            <div className="order-shop-money">
                <div><span>Items</span><span>{formatNaira(sellerOrder.subtotal)}</span></div>
                <div><span>Delivery</span><span>{formatNaira(sellerOrder.shipping)}</span></div>
                <div className="is-total"><span>Paid to this shop</span><span>{formatNaira(sellerOrder.total)}</span></div>
                {hasAmount(sellerOrder.refundedAmount) && (
                    <div className="is-refund"><span>Refunded to you</span><span>−{formatNaira(sellerOrder.refundedAmount)}</span></div>
                )}
            </div>

            {isDelivered && (
                <OrderReviewsPanel
                    checkoutId={order.id}
                    sellerOrderId={sellerOrder.id}
                    shop={{ name: shopName, logoUrl: shop?.logoUrl, brandColor: shop?.brandColor }}
                    items={sellerOrder.items}
                    scrollIntoView={openReview}
                />
            )}

            {(isDelivered || (canReport && !needsConfirm)) && (
                <div className="order-shop-foot">
                    {isDelivered && (
                        <span className="orders-muted">
                            {sellerOrder.deliveryConfirmedAt
                                ? `You confirmed delivery on ${formatOrderDay(sellerOrder.deliveryConfirmedAt)}.`
                                : sellerOrder.deliveryAutoClosedAt ? `Marked delivered on ${formatOrderDay(sellerOrder.deliveryAutoClosedAt)}, 7 days after the shop reported it.` : ""}
                        </span>
                    )}
                    {!isDelivered && <span className="orders-muted">The shop marks it delivered, then you confirm you got it.</span>}
                    {canReport && !needsConfirm && (
                        <Link to={`/orders/${order.id}/seller-orders/${sellerOrder.id}/complaint`} className="orders-report">Report a problem</Link>
                    )}
                </div>
            )}
        </article>
    )
}

// One of the shopper's paid orders: each shop's part with its progress, and a summary beside it with
// the payment and where it is being delivered.
function OrderDetailPage() {
    const { id = "" } = useParams()
    useDocumentTitle(`Order #${id}`)
    const reviewOrderId = useSearchParams()[0].get("review")// set by "Review your order" on My orders
    const [outcome, setOutcome] = useState<OrderOutcome<CustomerOrder> | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        fetchMyOrder(id, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [id, attempt])

    const back = (
        <Link to="/orders" className="order-back"><ArrowLeft size={18} aria-hidden="true" />My orders</Link>
    )

    if (outcome === null) {
        return <div className="order-page" aria-busy="true">{back}<p role="status">Loading your order...</p></div>
    }

    if (outcome.kind !== "ok") {
        return (
            <div className="order-page">
                {back}
                <h1 className="order-title">Order</h1>
                {outcome.kind === "not-found" && <Notice kind="warning">We could not find this order. It may belong to another account.</Notice>}
                {outcome.kind === "error" && (
                    <Notice kind="error">
                        <p>{outcome.message}</p>
                        <button type="button" className="btn" onClick={() => { setOutcome(null); setAttempt((count) => count + 1) }}>Try again</button>
                    </Notice>
                )}
            </div>
        )
    }

    const order = outcome.data
    const itemCount = order.sellerOrders.reduce((count, sellerOrder) => count + sellerOrder.items.reduce((sum, item) => sum + item.quantity, 0), 0)
    const shopCount = order.sellerOrders.length
    const itemsTotal = sumOf(order.sellerOrders.map((sellerOrder) => sellerOrder.subtotal))
    const deliveryTotal = sumOf(order.sellerOrders.map((sellerOrder) => sellerOrder.shipping))
    const refundedTotal = sumOf(order.sellerOrders.map((sellerOrder) => sellerOrder.refundedAmount))
    const reference = order.payment?.reference

    async function copyReference() {
        if (!reference) {
            return
        }
        try {
            await navigator.clipboard.writeText(reference)
            setCopied(true)
        } catch {
            setCopied(false)
        }
    }

    return (
        <div className="order-page">
            {back}
            <div className="order-title-row">
                <h1 className="order-title">Order #{order.id}</h1>
                <p>
                    Placed {formatOrderDay(order.createdAt, { year: true, time: true })} · {itemCount === 1 ? "1 item" : `${itemCount} items`}
                    {" "}from {shopCount === 1 ? "1 shop" : `${shopCount} shops`}
                </p>
            </div>

            <div className="order-grid">
                <div className="order-shops">
                    {order.sellerOrders.map((sellerOrder) => (
                        <ShopSection
                            key={sellerOrder.id}
                            order={order}
                            sellerOrder={sellerOrder}
                            openReview={reviewOrderId === String(sellerOrder.id)}
                            onConfirmed={(updated) => setOutcome({ kind: "ok", data: updated })}
                        />
                    ))}
                </div>

                <aside className="order-aside" aria-label="Order summary">
                    <section className="order-box">
                        <h2>Order summary</h2>
                        <div className="order-row"><span>Items ({itemCount})</span><span>{formatMinorUnits(itemsTotal)}</span></div>
                        <div className="order-row"><span>{shopCount === 1 ? "Delivery" : `Delivery from ${shopCount} shops`}</span><span>{formatMinorUnits(deliveryTotal)}</span></div>
                        <div className="order-row is-total"><span>Total paid</span><span>{formatNaira(order.total)}</span></div>
                        {refundedTotal > 0 && (
                            <div className="order-row is-refund"><span>Refunded to you</span><span>−{formatMinorUnits(refundedTotal)}</span></div>
                        )}
                    </section>

                    <section className="order-box">
                        <h2>Payment</h2>
                        <div className="order-row"><span>Paid with</span><span>{formatProvider(order.payment?.provider)}</span></div>
                        {order.payment?.paidAt && (
                            <div className="order-row"><span>Paid on</span><span>{formatOrderDay(order.payment.paidAt, { year: true, time: true })}</span></div>
                        )}
                        {reference && (
                            <>
                                <div className="order-row"><span>Reference</span><code className="order-reference">{reference}</code></div>
                                <div>
                                    <button type="button" className="order-copy" onClick={copyReference}>{copied ? "Copied" : "Copy reference"}</button>
                                    <span className="visually-hidden" aria-live="polite">{copied ? "Reference copied" : ""}</span>
                                </div>
                            </>
                        )}
                    </section>

                    <section className="order-box">
                        <h2>Delivering to</h2>
                        <p className="order-address">
                            <b>{order.delivery.fullName}</b><br />
                            {order.delivery.phone}<br />
                            {order.delivery.address}<br />
                            {order.delivery.lga}, {order.delivery.state}
                        </p>
                        {order.delivery.instructions && <p className="order-instructions">“{order.delivery.instructions}”</p>}
                    </section>

                    <section className="order-box">
                        <h2>Need help?</h2>
                        <p className="order-help">
                            If something is wrong with a shop's part of this order, use <b>Report a problem</b> under that shop.
                            The shop gets 3 days to reply, then StoreHatch steps in.
                        </p>
                        <Link to="/disputes" className="order-help-link">Your complaints</Link>
                    </section>
                </aside>
            </div>
        </div>
    )
}

export default OrderDetailPage
