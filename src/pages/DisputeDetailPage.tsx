import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, Lock } from "lucide-react"
import AdminDisputeDecision from "../components/AdminDisputeDecision"
import DisputeDetailView from "../components/DisputeDetailView"
import DisputeMessageForm from "../components/DisputeMessageForm"
import InlineConfirm from "../components/InlineConfirm"
import Notice from "../components/Notice"
import SellerRespondPanel from "../components/SellerRespondPanel"
import { failureMessage } from "../lib/apiRequest"
import type { ApiResult } from "../lib/apiRequest"
import { appealDispute, getDispute, isDisputeClosed, postDisputeMessage, withdrawDispute } from "../lib/disputeApi"
import { formatOrderDay } from "../lib/buyerOrders"
import ReopenDisputePanel from "../components/ReopenDisputePanel"
import type { DisputeViewer } from "../lib/disputeApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { Dispute } from "../types/dispute"

const LIST_PATHS: Record<DisputeViewer, string> = {
    buyer: "/disputes",
    seller: "/seller/disputes",
    admin: "/admin/complaints"
}

type LoadState =
    | { kind: "loading" }
    | { kind: "ready", dispute: Dispute }
    | { kind: "not-found" }
    | { kind: "error", message: string }

// One complaint, for the buyer, the seller or an administrator. The page loads it and offers the
// actions that fit the viewer and the complaint's state; the backend decides what is allowed.
function DisputeDetailPage({ viewer }: { viewer: DisputeViewer }) {
    useDocumentTitle("Complaint")
    const { id = "" } = useParams()
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()

        getDispute(viewer, id, controller.signal).then((result) => {
            if (controller.signal.aborted) {
                return
            }

            if (result.kind === "ok") {
                setState({ kind: "ready", dispute: result.data.dispute })
            } else if (result.kind === "failed" && result.status === 404) {
                setState({ kind: "not-found" })
            } else if (result.kind !== "unauthorized") {
                setState({ kind: "error", message: failureMessage(result) })
            }
        })

        return () => controller.abort()
    }, [viewer, id, attempt])

    // Runs one action that returns the updated complaint: shows it, or returns why it did not work.
    async function runAction(action: () => Promise<ApiResult<{ dispute: Dispute }>>): Promise<string | null> {
        const result = await action()

        if (result.kind === "ok") {
            setState({ kind: "ready", dispute: result.data.dispute })
            return null
        }

        return failureMessage(result)
    }

    const backLink = <Link to={LIST_PATHS[viewer]} className="order-back"><ArrowLeft size={18} aria-hidden="true" />Complaints</Link>

    if (state.kind === "loading") {
        return <p role="status">Loading the complaint...</p>
    }

    if (state.kind === "not-found") {
        return (
            <div>
                {backLink}
                <h1>Complaint</h1>
                <Notice kind="warning">We could not find this complaint.</Notice>
            </div>
        )
    }

    if (state.kind === "error") {
        return (
            <div>
                {backLink}
                <h1>Complaint</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((count) => count + 1) }}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { dispute } = state
    const isClosed = isDisputeClosed(dispute.status)
    const canWithdraw = !isClosed && ((viewer === "buyer" && dispute.openedBy === "BUYER") || (viewer === "seller" && dispute.openedBy === "SELLER"))
    const needsSellerResponse = viewer === "seller" && dispute.status === "OPEN" && dispute.openedBy === "BUYER"
    const needsDecision = viewer === "admin" && (dispute.status === "SELLER_AGREED" || dispute.status === "UNDER_REVIEW")

    const canAppeal = viewer === "buyer" && dispute.appeal?.canAppeal === true
    const canReopen = viewer === "admin" && dispute.status === "RESOLVED" && dispute.outcome === "REJECTED"

    const messageForm = (
        <DisputeMessageForm
            label="Write a message"
            submitLabel="Send message"
            onSend={(message, urls) => runAction(() => postDisputeMessage(viewer, dispute.id, message, urls))}
        />
    )

    // The message box at the end of the conversation. The seller's response and the administrator's
    // decision are themselves messages, so no second box is shown beside them; an administrator can
    // still ask a question without deciding, from the folded section.
    const composer = isClosed ? (
        <p className="complaint-closed">
            <Lock size={18} aria-hidden="true" />
            {dispute.status === "WITHDRAWN"
                ? "This was withdrawn, so it is closed."
                : canAppeal
                    ? "This complaint is closed. You can still appeal the decision above."
                    : dispute.appeal?.appealed
                        ? "This was appealed and decided again. The second decision is final."
                        : "This has been decided and is closed."}
        </p>
    ) : needsSellerResponse ? null : needsDecision ? (
        <details className="complaint-compose admin-issue">
            <summary>Message the buyer and seller without deciding</summary>
            {messageForm}
        </details>
    ) : (
        <div className="complaint-compose">
            {messageForm}
            {canWithdraw && (
                <div className="dispute-withdraw">
                    <InlineConfirm
                        buttonLabel={viewer === "buyer" ? "Withdraw my complaint" : "Withdraw my offer"}
                        prompt={viewer === "buyer"
                            ? "Withdraw this complaint? It will be closed and you cannot reopen it."
                            : "Withdraw this refund offer? It will be closed."}
                        confirmLabel="Yes, withdraw"
                        danger
                        onConfirm={() => runAction(() => withdrawDispute(viewer as "buyer" | "seller", dispute.id))}
                    />
                </div>
            )}
        </div>
    )

    return (
        <div className="complaints-page is-detail">
            {backLink}
            <DisputeDetailView dispute={dispute} viewer={viewer} composer={composer}>
                {needsSellerResponse && <SellerRespondPanel dispute={dispute} onUpdated={(updated) => setState({ kind: "ready", dispute: updated })} />}
                {needsDecision && <AdminDisputeDecision dispute={dispute} onUpdated={(updated) => setState({ kind: "ready", dispute: updated })} />}

                {canAppeal && (
                    <section aria-labelledby="appeal-heading" className="complaint-appeal">
                        <h2 id="appeal-heading">Think we got this wrong?</h2>
                        <p>Tell us what we missed, and add photos if you have them. StoreHatch will look at the complaint again.</p>
                        <p className="complaint-appeal-warning">
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>
                                You can appeal once{dispute.appeal?.deadline ? `, until ${formatOrderDay(dispute.appeal.deadline, { time: true })}` : ""}.
                                The second decision is final.
                            </span>
                        </p>
                        <DisputeMessageForm
                            label="Why should we look again?"
                            submitLabel="Send appeal"
                            onSend={(message, urls) => runAction(() => appealDispute(dispute.id, message, urls))}
                        />
                    </section>
                )}

                {canReopen && <ReopenDisputePanel dispute={dispute} onUpdated={(updated) => setState({ kind: "ready", dispute: updated })} />}
            </DisputeDetailView>
        </div>
    )
}

export default DisputeDetailPage
