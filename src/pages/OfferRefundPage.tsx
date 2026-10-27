import { useEffect, useState } from "react"
import BackArrow from "../components/BackArrow"
import { Link, useNavigate, useParams } from "react-router-dom"
import Notice from "../components/Notice"
import OrderItemList from "../components/OrderItemList"
import StartDisputeForm from "../components/StartDisputeForm"
import { failureMessage, isRecord } from "../lib/apiRequest"
import { offerRefund } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { fetchSellerOrder } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { SellerOrder } from "../types/order"

// Where a seller offers a buyer a refund on an order, for example when an item cannot be sent.
// The buyer is not asked to accept: StoreHatch issues the refund once the offer is made.
function OfferRefundPage() {
    useDocumentTitle("Offer a refund")
    const navigate = useNavigate()
    const { id = "" } = useParams()
    const [outcome, setOutcome] = useState<OrderOutcome<SellerOrder> | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        fetchSellerOrder(id, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [id, attempt])

    if (outcome === null) {
        return <p role="status">Loading the order...</p>
    }

    if (outcome.kind !== "ok") {
        return (
            <div>
                <h1>Offer a refund</h1>
                {outcome.kind === "error"
                    ? (
                        <Notice kind="error">
                            <p>{outcome.message}</p>
                            <button type="button" onClick={() => { setOutcome(null); setAttempt((count) => count + 1) }}>Try again</button>
                        </Notice>
                    )
                    : outcome.kind === "unauthorized"
                        ? <Notice kind="warning">Your session has ended. Please log in again.</Notice>
                        : <Notice kind="warning">We could not find this order.</Notice>}
                <Link to="/seller/orders">Back to orders</Link>
            </div>
        )
    }

    const order = outcome.data
    const existing = order.dispute

    return (
        <div className="form-page-wide">
            <BackArrow to={`/seller/orders/${order.id}`} label="Back to the order" />
            <h1>Offer a refund</h1>
            <p className="page-intro">
                Offer {order.delivery.fullName} a refund on order {order.id}. Once you send it, StoreHatch reviews it and issues the refund through the payment provider. The amount is then recovered from your later sales.
            </p>

            <section aria-label="The order" className="card summary-card">
                <OrderItemList items={order.items} />
                <div className="summary-row summary-row-total"><span>Order total</span><span>{formatNaira(order.total)}</span></div>
            </section>

            {existing ? (
                <Notice kind="info">
                    <p>There is already a complaint or refund offer for this order.</p>
                    <Link to={`/seller/disputes/${existing.id}`} className="btn">Open it</Link>
                </Notice>
            ) : (
                <section aria-labelledby="offer-heading" className="card form-card">
                    <h2 id="offer-heading">Your offer</h2>
                    <StartDisputeForm
                        showReason={false}
                        messageLabel="Message to the buyer"
                        amountLabel="Refund amount in naira (optional)"
                        submitLabel="Offer the refund"
                        onSubmit={async (input) => {
                            const result = await offerRefund(order.id, input.message, input.evidenceUrls, input.amount)

                            if (result.kind === "ok") {
                                navigate(`/seller/disputes/${result.data.dispute.id}`)
                                return null
                            }

                            if (result.kind === "failed" && result.code === "DISPUTE_EXISTS" && isRecord(result.body) && Number.isInteger(result.body.disputeId)) {
                                navigate(`/seller/disputes/${result.body.disputeId}`)
                                return null
                            }

                            if (result.kind === "failed" && result.code === "DISPUTE_AMOUNT_INVALID" && isRecord(result.body) && result.body.maximum !== undefined) {
                                return `${result.message} The most you can refund is ${formatNaira(String(result.body.maximum))}.`
                            }

                            return failureMessage(result)
                        }}
                    />
                </section>
            )}
        </div>
    )
}

export default OfferRefundPage
