import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Check, Clock } from "lucide-react"
import { OrderItemRow, OrderProgress } from "../components/BuyerOrderParts"
import InlineConfirm from "../components/InlineConfirm"
import Notice from "../components/Notice"
import ReadyTile from "../components/ReadyTile"
import ShopAvatar from "../components/ShopAvatar"
import { failureMessage } from "../lib/apiRequest"
import type { ApiResult } from "../lib/apiRequest"
import { formatOrderDay, readyTimeParts } from "../lib/buyerOrders"
import type { ProgressStep, StatusTone } from "../lib/buyerOrders"
import { formatNaira } from "../lib/money"
import { approvePreOrder, canPayNow, cancelPreOrder, declinePreOrder, describePreOrder, getPreOrder } from "../lib/preOrderApi"
import type { PreOrderViewer } from "../lib/preOrderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { ORDER_MAX_VALUE } from "../lib/limits"
import { PRE_ORDER_NOTE_MAX_LENGTH } from "../types/preOrder"
import type { PreOrder } from "../types/preOrder"

const LIST_PATHS: Record<PreOrderViewer, string> = {
    buyer: "/pre-orders",
    seller: "/seller/pre-orders"
}

const TONE_BY_PRE_ORDER: Record<string, StatusTone> = { attention: "attention", neutral: "neutral", good: "done", bad: "neutral" }

type AnswerPanelProps = {
    preOrder: PreOrder
    onUpdated: (preOrder: PreOrder) => void
}

// The shop's answer: approve (with an optional note) or decline (a reason is needed).
function SellerAnswerPanel({ preOrder, onUpdated }: AnswerPanelProps) {
    const [note, setNote] = useState("")
    const [working, setWorking] = useState<"approve" | "decline" | null>(null)
    const [error, setError] = useState("")

    async function answer(action: "approve" | "decline") {
        if (working !== null) {
            return
        }

        const trimmed = note.trim()
        if (action === "decline" && trimmed.length < 3) {
            setError("Tell the buyer why in at least 3 characters.")
            return
        }

        setWorking(action)
        setError("")
        const result = await (action === "approve" ? approvePreOrder(preOrder.id, trimmed) : declinePreOrder(preOrder.id, trimmed))
        setWorking(null)

        if (result.kind === "ok") {
            onUpdated(result.data.preOrder)
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <section aria-labelledby="answer-heading" className="preorder-action">
            <h2 id="answer-heading">Your answer</h2>
            <p>
                Approving gives {preOrder.buyerName ?? "the buyer"} up to 24 hours to pay (and no later than an hour before the ready time).
                You cannot suggest another time: if it does not suit you, decline with a reason and they can ask again.
            </p>
            <p className="field-help">
                An order from one shop, pre-orders included, can be up to {formatNaira(ORDER_MAX_VALUE)}, delivery included. Do not approve one above that: the buyer will not be able to pay for it.
            </p>
            {Number(preOrder.subtotal) > Number(ORDER_MAX_VALUE) && (
                <Notice kind="warning">
                    This request is {formatNaira(preOrder.subtotal)} before delivery, which is above {formatNaira(ORDER_MAX_VALUE)}. Decline it and ask the buyer to send a smaller one.
                </Notice>
            )}
            <label className="review-comment">
                Note for the buyer (needed to decline)
                <textarea maxLength={PRE_ORDER_NOTE_MAX_LENGTH} value={note} disabled={working !== null} onChange={(event) => setNote(event.target.value)} />
            </label>
            {error && <Notice kind="error">{error}</Notice>}
            <div className="review-actions">
                <button type="button" className="btn btn-primary" onClick={() => answer("approve")} disabled={working !== null}>
                    {working === "approve" ? "Approving..." : "Approve"}
                </button>
                <button type="button" className="btn" onClick={() => answer("decline")} disabled={working !== null}>
                    {working === "decline" ? "Declining..." : "Decline"}
                </button>
            </div>
        </section>
    )
}

// You asked, the shop's answer, the payment and the ready time.
function preOrderSteps(preOrder: PreOrder, viewer: PreOrderViewer): ProgressStep[] {
    const day = (isoTime: string | null) => formatOrderDay(isoTime, { time: true })
    const { status, decidedAt } = preOrder
    const wasApproved = decidedAt !== null && status !== "DECLINED"

    const answer: ProgressStep = status === "REQUESTED"
        ? { label: "Shop approves", detail: preOrder.respondBy ? `By ${day(preOrder.respondBy)}` : "Waiting", state: "waiting" }
        : status === "DECLINED"
            ? { label: "Shop declined", detail: day(decidedAt), state: "stopped" }
            : wasApproved
                ? { label: "Shop approved", detail: day(decidedAt), state: "done" }
                : { label: "Shop's answer", detail: status === "CANCELLED" ? "Cancelled first" : "No answer in time", state: "stopped" }

    const payer = viewer === "buyer" ? "You pay" : "Buyer pays"
    const payment: ProgressStep = status === "APPROVED"
        ? { label: payer, detail: preOrder.payBy ? `By ${day(preOrder.payBy)}` : "Waiting", state: "waiting" }
        : status === "USED"
            ? { label: "Paid", detail: "", state: "done" }
            : wasApproved
                ? { label: payer, detail: status === "CANCELLED" ? "Cancelled" : "Not paid in time", state: "stopped" }
                : { label: payer, detail: status === "REQUESTED" ? "Not yet" : "—", state: "next" }

    return [
        { label: viewer === "buyer" ? "You asked" : "Asked", detail: day(preOrder.createdAt), state: "done" },
        answer,
        payment,
        { label: "Ready", detail: day(preOrder.readyAt), state: "next" }
    ]
}

// One pre-order request, for the buyer or the shop. The buyer can cancel an open one and, once it is
// approved, goes to checkout to pay. The shop approves or declines.
function PreOrderDetailPage({ viewer }: { viewer: PreOrderViewer }) {
    useDocumentTitle("Pre-order")
    const { id = "" } = useParams()
    const { state, setData, reload } = useApiResource(`${viewer}|${id}`, (signal) => getPreOrder(viewer, id, signal))

    const back = <Link to={LIST_PATHS[viewer]} className="order-back"><ArrowLeft size={18} aria-hidden="true" />Pre-orders</Link>

    if (state.kind === "loading") {
        return <div className="complaints-page" aria-busy="true">{back}<p role="status">Loading the pre-order...</p></div>
    }

    if (state.kind === "error") {
        return (
            <div className="complaints-page">
                {back}
                <h1>Pre-order</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" className="btn" onClick={reload}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { preOrder } = state.data
    const shop = preOrder.seller
    const shopName = shop.businessName ?? "The shop"
    const status = describePreOrder(preOrder, viewer)
    const ready = readyTimeParts(preOrder.readyAt)
    const hasEnded = ["DECLINED", "EXPIRED", "CANCELLED"].includes(preOrder.status)
    const itemCount = preOrder.items.reduce((count, item) => count + item.quantity, 0)
    const canCancel = viewer === "buyer" && (preOrder.status === "REQUESTED" || preOrder.status === "APPROVED")
    const showShopNoteSeparately = !(viewer === "buyer" && preOrder.status === "DECLINED")

    function show(updated: PreOrder) {
        setData(() => ({ preOrder: updated }))
    }

    async function runCancel(): Promise<string | null> {
        const result: ApiResult<{ preOrder: PreOrder }> = await cancelPreOrder(preOrder.id)

        if (result.kind === "ok") {
            show(result.data.preOrder)
            return null
        }

        return failureMessage(result)
    }

    return (
        <div className="complaints-page is-detail">
            {back}

            <section className="preorder-hero" aria-labelledby="preorder-heading">
                <ReadyTile preOrder={preOrder} large />
                <div className="preorder-hero-text">
                    <h1 id="preorder-heading">{hasEnded ? "Was for" : "Ready"} {ready.long}</h1>
                    <p>
                        {viewer === "buyer" ? `From ${shopName}` : `For ${preOrder.buyerName ?? "a buyer"}`}
                        {" "}· {itemCount === 1 ? "1 item" : `${itemCount} items`} · {formatNaira(preOrder.subtotal)} before delivery
                    </p>
                </div>
                <span className={`orders-status is-${TONE_BY_PRE_ORDER[status.tone]}`}>{status.label}</span>
            </section>

            <section className="complaint-progress" aria-label="Where this pre-order stands">
                <OrderProgress steps={preOrderSteps(preOrder, viewer)} large />
            </section>

            <div className="complaint-grid">
                <div className="complaint-main">
                    {viewer === "seller" && preOrder.status === "REQUESTED" && <SellerAnswerPanel preOrder={preOrder} onUpdated={show} />}

                    {viewer === "buyer" && preOrder.status === "REQUESTED" && (
                        <section className="preorder-action" aria-labelledby="action-heading">
                            <h2 id="action-heading">Waiting for {shopName}</h2>
                            <p>
                                {preOrder.respondBy ? <>They have until <b>{formatOrderDay(preOrder.respondBy, { time: true })}</b> to approve or decline. </> : "They will approve or decline. "}
                                Nothing is charged until you pay. If they don't answer in time, the request lapses and you can ask again.
                            </p>
                        </section>
                    )}

                    {viewer === "buyer" && preOrder.status === "APPROVED" && (
                        <section className="preorder-action is-attention" aria-labelledby="action-heading">
                            <h2 id="action-heading"><Check size={22} aria-hidden="true" />{shopName} approved your pre-order</h2>
                            {canPayNow(preOrder) ? (
                                <>
                                    {preOrder.payBy && (
                                        <div className="preorder-deadline">
                                            <Clock size={28} aria-hidden="true" />
                                            <div>
                                                <b>Pay by {readyTimeParts(preOrder.payBy).long}</b>
                                                <span>After that the approval lapses and you would need to ask again.</span>
                                            </div>
                                        </div>
                                    )}
                                    <p className="orders-muted">Checkout uses these items at these prices, with delivery added. Keep the same items in your cart.</p>
                                    <div><Link to="/checkout" className="btn btn-primary btn-lg">Go to checkout and pay</Link></div>
                                </>
                            ) : (
                                <p>The time to pay has passed, so this approval is lapsing. You can ask again from checkout.</p>
                            )}
                        </section>
                    )}

                    {viewer === "buyer" && preOrder.status === "DECLINED" && (
                        <section className="preorder-action" aria-labelledby="action-heading">
                            <h2 id="action-heading">{shopName} couldn't take this one</h2>
                            {preOrder.sellerNote && <p className="preorder-quote"><small>Their note</small>“{preOrder.sellerNote}”</p>}
                            <p className="orders-muted">You weren't charged. You can ask again for another time from checkout, with the same items in your cart.</p>
                            <div><Link to="/cart" className="btn btn-primary">Go to your cart</Link></div>
                        </section>
                    )}

                    {preOrder.status === "EXPIRED" && (
                        <section className="preorder-action" aria-labelledby="action-heading">
                            <h2 id="action-heading">This request lapsed</h2>
                            <p>
                                {preOrder.decidedAt ? "It was approved but not paid in time." : "The shop did not answer in time."}
                                {viewer === "buyer" && " You weren't charged, and you can ask again from checkout."}
                            </p>
                        </section>
                    )}

                    {preOrder.status === "CANCELLED" && (
                        <section className="preorder-action" aria-labelledby="action-heading">
                            <h2 id="action-heading">Cancelled</h2>
                            <p>{viewer === "buyer" ? "You cancelled this request. You can ask again from checkout." : "The buyer cancelled this request."}</p>
                        </section>
                    )}

                    {preOrder.status === "USED" && (
                        <section className="preorder-action is-good" aria-labelledby="action-heading">
                            <h2 id="action-heading"><Check size={22} aria-hidden="true" />Paid</h2>
                            <p>It is now an order with this ready time.</p>
                            <div><Link to={viewer === "buyer" ? "/orders" : "/seller/orders"} className="btn">{viewer === "buyer" ? "Go to My orders" : "Go to orders"}</Link></div>
                        </section>
                    )}

                    {viewer === "seller" && (preOrder.status === "APPROVED" || preOrder.status === "DECLINED") && (
                        <section className="preorder-action" aria-labelledby="action-heading">
                            <h2 id="action-heading">{preOrder.status === "APPROVED" ? "Approved" : "Declined"}</h2>
                            <p>
                                {preOrder.status === "APPROVED"
                                    ? `${preOrder.buyerName ?? "The buyer"} ${preOrder.payBy ? `has until ${formatOrderDay(preOrder.payBy, { time: true })} to pay` : "can now pay"}.`
                                    : "You declined this request. The buyer can ask again for another time."}
                            </p>
                        </section>
                    )}

                    {(preOrder.note || (preOrder.sellerNote && showShopNoteSeparately)) && (
                        <section className="preorder-notes" aria-labelledby="notes-heading">
                            <h2 id="notes-heading">Notes</h2>
                            {preOrder.note && <p className="preorder-quote"><small>{viewer === "buyer" ? "Your note" : "Note from the buyer"}</small>{preOrder.note}</p>}
                            {preOrder.sellerNote && showShopNoteSeparately && (
                                <p className="preorder-quote is-shop"><small>{viewer === "buyer" ? shopName : "Your note"}</small>{preOrder.sellerNote}</p>
                            )}
                        </section>
                    )}

                    {canCancel && (
                        <div className="dispute-withdraw">
                            <InlineConfirm
                                buttonLabel="Cancel this request"
                                prompt="Cancel this pre-order request? You can ask again later."
                                confirmLabel="Yes, cancel it"
                                danger
                                onConfirm={runCancel}
                            />
                        </div>
                    )}
                </div>

                <aside className="complaint-aside" aria-label="Pre-order details">
                    <section className="order-box">
                        <h2>{viewer === "buyer" ? "What you asked for" : "What was asked for"}</h2>
                        <ul className="orders-items">
                            {preOrder.items.map((item) => <OrderItemRow key={item.listingId} item={item} />)}
                        </ul>
                        <div className="order-row is-total"><span>Subtotal</span><span>{formatNaira(preOrder.subtotal)}</span></div>
                        <span className="orders-muted">Delivery is added at checkout.</span>
                    </section>

                    {viewer === "buyer" && (
                        <section className="order-box">
                            <h2>The shop</h2>
                            <div className="complaint-shop">
                                <ShopAvatar name={shop.businessName} logoUrl={shop.logoUrl} brandColor={shop.brandColor ?? undefined} />
                                <div>
                                    <b>{shopName}</b>
                                    {shop.location && <span>{shop.location}</span>}
                                </div>
                            </div>
                            {shop.slug && <Link to={`/shop/${encodeURIComponent(shop.slug)}`} className="order-help-link">Visit the shop</Link>}
                        </section>
                    )}

                    <section className="order-box">
                        <h2>Pre-order #{preOrder.id}</h2>
                        <div className="order-row"><span>Asked</span><span>{formatOrderDay(preOrder.createdAt, { year: true, time: true })}</span></div>
                        {preOrder.decidedAt && <div className="order-row"><span>Answered</span><span>{formatOrderDay(preOrder.decidedAt, { year: true, time: true })}</span></div>}
                    </section>
                </aside>
            </div>
        </div>
    )
}

export default PreOrderDetailPage
