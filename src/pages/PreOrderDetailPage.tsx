import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import BackArrow from "../components/BackArrow"
import InlineConfirm from "../components/InlineConfirm"
import Notice from "../components/Notice"
import PreOrderBadge from "../components/PreOrderBadge"
import { failureMessage } from "../lib/apiRequest"
import type { ApiResult } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { approvePreOrder, cancelPreOrder, declinePreOrder, getPreOrder } from "../lib/preOrderApi"
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
        <section aria-labelledby="answer-heading" className="card summary-card">
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
            <label>
                Note for the buyer (needed to decline)
                <textarea maxLength={PRE_ORDER_NOTE_MAX_LENGTH} value={note} disabled={working !== null} onChange={(event) => setNote(event.target.value)} />
            </label>
            {error && <Notice kind="error">{error}</Notice>}
            <div className="action-row">
                <button type="button" className="btn btn-primary" onClick={() => answer("approve")} disabled={working !== null}>
                    {working === "approve" ? "Approving..." : "Approve"}
                </button>
                <button type="button" onClick={() => answer("decline")} disabled={working !== null}>
                    {working === "decline" ? "Declining..." : "Decline"}
                </button>
            </div>
        </section>
    )
}

// One pre-order request, for the buyer or the shop. The buyer can cancel an open one and, once it is
// approved, goes to checkout to pay. The shop approves or declines.
function PreOrderDetailPage({ viewer }: { viewer: PreOrderViewer }) {
    useDocumentTitle("Pre-order")
    const { id = "" } = useParams()
    const { state, setData, reload } = useApiResource(`${viewer}|${id}`, (signal) => getPreOrder(viewer, id, signal))

    const back = <BackArrow to={LIST_PATHS[viewer]} label="Back to pre-orders" />

    if (state.kind === "loading") {
        return <p role="status">Loading the pre-order...</p>
    }

    if (state.kind === "error") {
        return (
            <div>
                {back}
                <h1>Pre-order</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { preOrder } = state.data

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
        <div>
            {back}
            <div className="order-header">
                <h1>Pre-order {preOrder.id}</h1>
                <PreOrderBadge preOrder={preOrder} viewer={viewer} />
            </div>

            {viewer === "buyer" && preOrder.status === "APPROVED" && (
                <Notice kind="success">
                    <p>
                        {preOrder.seller.businessName} approved this.
                        {preOrder.payBy && <> Pay by {formatShortDate(preOrder.payBy)}, or the approval lapses.</>}
                    </p>
                    <p>Go to checkout with the same items in your cart, at the same prices, and pay as usual.</p>
                    <Link to="/checkout" className="btn btn-primary">Go to checkout</Link>
                </Notice>
            )}
            {viewer === "buyer" && preOrder.status === "DECLINED" && (
                <Notice kind="warning">{preOrder.seller.businessName} declined this request. You can ask again for another time.</Notice>
            )}
            {preOrder.status === "EXPIRED" && (
                <Notice kind="warning">
                    {preOrder.decidedAt ? "This approval was not paid in time, so it lapsed." : "The shop did not answer in time, so this request lapsed."}
                    {viewer === "buyer" && " You can ask again from checkout."}
                </Notice>
            )}
            {preOrder.status === "USED" && <Notice kind="info">This was paid for. It is now an order with a ready time.</Notice>}

            <section aria-labelledby="preorder-about-heading" className="card summary-card">
                <h2 id="preorder-about-heading">About this request</h2>
                <dl className="detail-list">
                    <div><dt>{viewer === "buyer" ? "Shop" : "Buyer"}</dt><dd>{viewer === "buyer" ? preOrder.seller.businessName : preOrder.buyerName ?? "A buyer"}</dd></div>
                    <div><dt>Ready on</dt><dd>{formatShortDate(preOrder.readyAt)}</dd></div>
                    <div><dt>Asked</dt><dd>{formatShortDate(preOrder.createdAt)}</dd></div>
                    {preOrder.status === "REQUESTED" && preOrder.respondBy && (
                        <div><dt>{viewer === "seller" ? "Answer by" : "The shop should answer by"}</dt><dd>{formatShortDate(preOrder.respondBy)}</dd></div>
                    )}
                    {preOrder.status === "APPROVED" && preOrder.payBy && <div><dt>Pay by</dt><dd>{formatShortDate(preOrder.payBy)}</dd></div>}
                    {preOrder.decidedAt && <div><dt>Answered</dt><dd>{formatShortDate(preOrder.decidedAt)}</dd></div>}
                </dl>
                {preOrder.note && <p className="stepper-shipping-note"><strong>{viewer === "buyer" ? "Your note" : "Note from the buyer"}:</strong> {preOrder.note}</p>}
                {preOrder.sellerNote && <p className="stepper-shipping-note"><strong>{viewer === "buyer" ? `Note from ${preOrder.seller.businessName}` : "Your note"}:</strong> {preOrder.sellerNote}</p>}

                <h3 className="order-section-title">What was asked for</h3>
                <ul className="order-lines">
                    {preOrder.items.map((item) => (
                        <li key={item.listingId} className="order-line">
                            <div>
                                <p className="order-line-title">{item.title}</p>
                                <p className="order-line-meta">{formatNaira(item.unitPrice)} × {item.quantity}</p>
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="summary-row summary-row-total"><span>Subtotal (before delivery)</span><span>{formatNaira(preOrder.subtotal)}</span></div>
            </section>

            {viewer === "seller" && preOrder.status === "REQUESTED" && <SellerAnswerPanel preOrder={preOrder} onUpdated={show} />}

            {viewer === "buyer" && (preOrder.status === "REQUESTED" || preOrder.status === "APPROVED") && (
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
    )
}

export default PreOrderDetailPage
