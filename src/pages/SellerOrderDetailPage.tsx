import { useEffect, useId, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Check, CircleAlert, Truck } from "lucide-react"
import BackArrow from "../components/BackArrow"
import { OrderItemRow, OrderProgress } from "../components/BuyerOrderParts"
import Notice from "../components/Notice"
import RefundList from "../components/RefundList"
import { formatOrderDay } from "../lib/buyerOrders"
import { describeDispute } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { fetchSellerOrder, formatProvider, hasAmount } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { canReportDelivered, canShip, describeSellerStatus, sellerProgressSteps, useFulfilmentAction } from "../lib/sellerOrders"
import type { FulfilmentUpdate } from "../lib/sellerOrders"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { SellerOrder } from "../types/order"

const SHORT_REASONS: Record<string, string> = {
    NOT_RECEIVED: "order not received",
    NOT_AS_DESCRIBED: "item not as described",
    DAMAGED: "item arrived damaged",
    WRONG_ITEM: "wrong item sent",
    OTHER: "a problem with the order",
    SELLER_REFUND_OFFER: "your refund offer"
}

// What to do next with the order: ship it, mark it delivered, or wait for the buyer.
function NextStep({ order, onUpdated }: { order: SellerOrder, onUpdated: (update: FulfilmentUpdate) => void }) {
    const noteId = useId()
    const [note, setNote] = useState("")
    const action = useFulfilmentAction(order.id, onUpdated)
    const buyer = order.delivery.fullName.trim().split(/\s+/)[0] || "the buyer"

    if (canShip(order)) {
        return (
            <section className="seller-next" aria-labelledby="next-heading">
                <h2 id="next-heading"><Truck size={20} aria-hidden="true" />Ship this order</h2>
                <p>Pack the items below and send them to {buyer}. Add the courier and tracking number so they can follow it.</p>
                <div className="product-field">
                    <label htmlFor={noteId}>Courier and tracking number <span className="option-muted">(optional, the buyer sees this)</span></label>
                    <input id={noteId} className="product-input" maxLength={200} placeholder="For example: GIG Logistics, waybill GL-22841" value={note} disabled={action.isWorking} onChange={(event) => setNote(event.target.value)} />
                </div>
                {action.error && <Notice kind="error">{action.error}</Notice>}
                <div className="seller-next-actions">
                    <button type="button" className="btn btn-primary" disabled={action.isWorking} onClick={() => action.ship(note)}>
                        {action.isWorking ? "Saving..." : "Mark as shipped"}
                    </button>
                    <button type="button" className="btn-text" disabled={action.isWorking} onClick={() => action.reportDelivered()}>
                        Delivered it yourself? Mark as delivered
                    </button>
                </div>
            </section>
        )
    }

    if (canReportDelivered(order)) {
        return (
            <section className="seller-next" aria-labelledby="next-heading">
                <h2 id="next-heading">On its way to {buyer}</h2>
                {order.shippingNote && <p className="seller-next-note"><b>Your note to the buyer:</b> {order.shippingNote}</p>}
                <p>When it arrives, mark it delivered. {buyer} is then asked to confirm they got it.</p>
                {action.error && <Notice kind="error">{action.error}</Notice>}
                <div className="seller-next-actions">
                    <button type="button" className="btn btn-primary" disabled={action.isWorking} onClick={() => action.reportDelivered()}>
                        {action.isWorking ? "Saving..." : "Mark as delivered"}
                    </button>
                </div>
            </section>
        )
    }

    if (order.status === "SHIPPED" && order.deliveryReportedAt) {
        return (
            <section className="seller-next is-waiting" aria-labelledby="next-heading">
                <h2 id="next-heading"><Check size={20} aria-hidden="true" />Waiting for {buyer} to confirm</h2>
                <p>You marked it delivered. {buyer} has been asked to confirm they got it. If they don't answer within 7 days, it counts as delivered.</p>
            </section>
        )
    }

    return null
}

// One of the seller's paid orders: where it is, what to do next, what to send and where, and the
// money, with complaints and refunds when there are any.
function SellerOrderDetailPage() {
    const { id = "" } = useParams()
    useDocumentTitle(`Order #${id}`)
    const [outcome, setOutcome] = useState<OrderOutcome<SellerOrder> | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        fetchSellerOrder(id, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [id, attempt])

    const back = <BackArrow to="/seller/orders" label="Back to orders" />

    if (outcome === null) {
        return <div className="seller-orders-page is-detail">{back}<p role="status">Loading order...</p></div>
    }

    if (outcome.kind !== "ok") {
        return (
            <div className="seller-orders-page is-detail">
                {back}
                <h1>Order</h1>
                {outcome.kind === "not-found" && <Notice kind="warning">We could not find this order.</Notice>}
                {outcome.kind === "unauthorized" && <Notice kind="warning">Your session has ended. Please log in again.</Notice>}
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
    const status = describeSellerStatus(order)
    const delivery = order.delivery
    const buyerFirstName = delivery.fullName.trim().split(/\s+/)[0] || "The buyer"
    const canOfferRefund = order.dispute === null && ["PAID", "SHIPPED", "DELIVERED"].includes(order.status)
    const addressText = [delivery.fullName, delivery.phone, delivery.address, `${delivery.lga}, ${delivery.state}`].join("\n")

    async function copyAddress() {
        try {
            await navigator.clipboard.writeText(addressText)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            // Copying can be blocked by the browser; the address is on the page to copy by hand.
        }
    }

    return (
        <div className="seller-orders-page is-detail">
            {back}
            <div className="complaint-title">
                <h1>Order #{order.id}</h1>
                <span className={`orders-status is-${status.tone}`}>{status.label}</span>
            </div>
            <p className="complaint-sub">
                Paid {formatOrderDay(order.paidAt ?? order.createdAt, { year: true, time: true })} with {formatProvider(order.provider)} · {delivery.fullName}
            </p>

            <section className="complaint-progress" aria-label="Where this order is">
                <OrderProgress steps={sellerProgressSteps(order)} large />
                {order.fulfilmentType === "PRE_ORDER" && order.readyAt && (
                    <p className="complaint-next is-plain">Pre-order: have it ready by <b>{formatOrderDay(order.readyAt, { time: true })}</b>.</p>
                )}
            </section>

            <div className="complaint-grid">
                <div className="complaint-main">
                    {order.dispute && (
                        <section className="seller-complaint" aria-labelledby="complaint-heading">
                            <h2 id="complaint-heading"><CircleAlert size={20} aria-hidden="true" />Complaint: {SHORT_REASONS[order.dispute.reason] ?? SHORT_REASONS.OTHER}</h2>
                            {order.dispute.status === "OPEN" ? (
                                <p>
                                    {buyerFirstName} asked for {order.dispute.requestedAmount && hasAmount(order.dispute.requestedAmount) ? <>a refund of <b>{formatNaira(order.dispute.requestedAmount)}</b></> : "a refund"}
                                    {order.dispute.createdAt ? ` on ${formatOrderDay(order.dispute.createdAt)}` : ""}.
                                    {order.dispute.responseDueAt && <> Agree to refund, or explain your side, by <b>{formatOrderDay(order.dispute.responseDueAt, { time: true })}</b>.</>}
                                    {" "}If you don't answer in time, StoreHatch decides without your side.
                                </p>
                            ) : (
                                <p>{describeDispute(order.dispute, "seller").label}.</p>
                            )}
                            <div className="seller-next-actions">
                                <Link to={`/seller/disputes/${order.dispute.id}`} className={order.dispute.status === "OPEN" ? "btn btn-primary" : "btn"}>
                                    {order.dispute.status === "OPEN" ? "Answer the complaint" : "View the complaint"}
                                </Link>
                                <span className="orders-muted">Complaint #{order.dispute.id}</span>
                            </div>
                        </section>
                    )}

                    <NextStep order={order} onUpdated={(update) => setOutcome({ kind: "ok", data: { ...order, ...update } })} />

                    <section className="seller-card" aria-labelledby="items-heading">
                        <h2 id="items-heading">{canShip(order) ? "Items to send" : "Items in this order"}</h2>
                        <ul className="orders-items seller-items">
                            {order.items.map((item, index) => <OrderItemRow key={`${item.listingId}-${index}`} item={item} />)}
                        </ul>
                    </section>

                    {order.refunds.length > 0 && (
                        <section className="seller-card" aria-label="Refunds">
                            <RefundList refunds={order.refunds} heading="Refunds" />
                        </section>
                    )}
                </div>

                <aside className="complaint-aside" aria-label="Delivery and money">
                    <section className="order-box">
                        <h2>Deliver to</h2>
                        <p className="order-address">
                            <b>{delivery.fullName}</b><br />
                            <a href={`tel:${delivery.phone.replace(/\s+/g, "")}`}>{delivery.phone}</a><br />
                            {delivery.address}<br />
                            {delivery.lga}, {delivery.state}
                        </p>
                        {delivery.instructions && <p className="order-instructions">“{delivery.instructions}”</p>}
                        <div>
                            <button type="button" className="order-copy" onClick={copyAddress}>{copied ? "Copied" : "Copy address"}</button>
                            <span className="visually-hidden" aria-live="polite">{copied ? "Address copied" : ""}</span>
                        </div>
                    </section>

                    <section className="order-box">
                        <h2>Money</h2>
                        <div className="order-row"><span>Items</span><span>{formatNaira(order.subtotal)}</span></div>
                        <div className="order-row"><span>Delivery</span><span>{formatNaira(order.shipping)}</span></div>
                        <div className="order-row"><span>Buyer paid</span><span>{formatNaira(order.total)}</span></div>
                        <div className="order-row">
                            <span>{formatProvider(order.provider)} fee, VAT and stamp duty</span>
                            <span>{order.providerFee !== null ? `−${formatNaira(order.providerFee)}` : "Not reported yet"}</span>
                        </div>
                        {hasAmount(order.refundedAmount) && <div className="order-row"><span>Refunded to the buyer</span><span>−{formatNaira(order.refundedAmount)}</span></div>}
                        {hasAmount(order.liabilityDeduction) && <div className="order-row"><span>Kept for an earlier refund</span><span>−{formatNaira(order.liabilityDeduction)}</span></div>}
                        <div className="order-row is-total">
                            <span>You receive</span>
                            <span>{order.sellerReceives !== null ? formatNaira(order.sellerReceives) : "Not reported yet"}</span>
                        </div>
                        <p className="order-help">{formatProvider(order.provider)} pays this into your payout account on its usual schedule.</p>
                    </section>

                    {canOfferRefund && (
                        <section className="order-box">
                            <h2>Something wrong?</h2>
                            <p className="order-help">If an item is missing or you can't send it, offer the buyer a refund. StoreHatch checks it and sends the money back to them.</p>
                            <Link to={`/seller/orders/${order.id}/refund-offer`} className="order-help-link">Offer a refund</Link>
                        </section>
                    )}
                </aside>
            </div>
        </div>
    )
}

export default SellerOrderDetailPage
