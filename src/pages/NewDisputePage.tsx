import { useEffect, useState } from "react"
import BackArrow from "../components/BackArrow"
import { Link, useNavigate, useParams } from "react-router-dom"
import Notice from "../components/Notice"
import OrderItemList from "../components/OrderItemList"
import StartDisputeForm from "../components/StartDisputeForm"
import { failureMessage, isRecord } from "../lib/apiRequest"
import { openDispute } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { fetchMyOrder } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { CustomerOrder } from "../types/order"

// Where a shopper reports a problem with one seller's order (for example "I did not receive it").
function NewDisputePage() {
    useDocumentTitle("Report a problem")
    const navigate = useNavigate()
    const { checkoutId = "", orderId = "" } = useParams()
    const [outcome, setOutcome] = useState<OrderOutcome<CustomerOrder> | null>(null)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        fetchMyOrder(checkoutId, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [checkoutId, attempt])

    const backTo = `/orders/${checkoutId}`

    if (outcome === null) {
        return <p role="status">Loading your order...</p>
    }

    const sellerOrder = outcome.kind === "ok"
        ? outcome.data.sellerOrders.find((candidate) => String(candidate.id) === orderId)
        : undefined

    if (outcome.kind !== "ok" || !sellerOrder) {
        return (
            <div>
                <h1>Report a problem</h1>
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
                <Link to="/orders">Back to my orders</Link>
            </div>
        )
    }

    const existing = sellerOrder.dispute

    return (
        <div className="form-page-wide">
            <BackArrow to={backTo} label="Back to the order" />
            <h1>Report a problem</h1>
            <p className="page-intro">
                Tell us what went wrong with your order from {sellerOrder.seller?.businessName ?? "the seller"}. The seller is asked to respond first, and StoreHatch steps in if you cannot agree.
            </p>

            <section aria-label="The order" className="card summary-card">
                <OrderItemList items={sellerOrder.items} />
                <div className="summary-row summary-row-total"><span>Order total</span><span>{formatNaira(sellerOrder.total)}</span></div>
            </section>

            {existing ? (
                <Notice kind="info">
                    <p>You already have a complaint open for this order.</p>
                    <Link to={`/disputes/${existing.id}`} className="btn">Open complaint {existing.id}</Link>
                </Notice>
            ) : (
                <section aria-labelledby="complaint-heading" className="card form-card">
                    <h2 id="complaint-heading">Your complaint</h2>
                    <StartDisputeForm
                        showReason
                        messageLabel="Describe the problem"
                        amountLabel="Refund you are asking for, in naira (optional)"
                        submitLabel="Send complaint"
                        onSubmit={async (input) => {
                            const result = await openDispute(outcome.data.id, sellerOrder.id, {
                                reason: input.reason,
                                message: input.message,
                                amount: input.amount,
                                evidenceUrls: input.evidenceUrls
                            })

                            if (result.kind === "ok") {
                                navigate(`/disputes/${result.data.dispute.id}`)
                                return null
                            }

                            if (result.kind === "failed" && result.code === "DISPUTE_EXISTS" && isRecord(result.body) && Number.isInteger(result.body.disputeId)) {
                                navigate(`/disputes/${result.body.disputeId}`)
                                return null
                            }

                            if (result.kind === "failed" && result.code === "DISPUTE_AMOUNT_INVALID" && isRecord(result.body) && result.body.maximum !== undefined) {
                                return `${result.message} The most you can ask for is ${formatNaira(String(result.body.maximum))}.`
                            }

                            return failureMessage(result)
                        }}
                    />
                </section>
            )}
        </div>
    )
}

export default NewDisputePage
