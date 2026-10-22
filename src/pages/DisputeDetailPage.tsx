import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import AdminDisputeDecision from "../components/AdminDisputeDecision"
import DisputeDetailView from "../components/DisputeDetailView"
import DisputeMessageForm from "../components/DisputeMessageForm"
import InlineConfirm from "../components/InlineConfirm"
import Notice from "../components/Notice"
import SellerRespondPanel from "../components/SellerRespondPanel"
import { failureMessage } from "../lib/apiRequest"
import type { ApiResult } from "../lib/apiRequest"
import { appealDispute, getDispute, isDisputeClosed, postDisputeMessage, withdrawDispute } from "../lib/disputeApi"
import { formatShortDate } from "../lib/orderApi"
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

    const backLink = <p className="page-back"><Link to={LIST_PATHS[viewer]} className="back-link">Back to complaints</Link></p>

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
            label="Your message"
            submitLabel="Send message"
            onSend={(message, urls) => runAction(() => postDisputeMessage(viewer, dispute.id, message, urls))}
        />
    )

    return (
        <div>
            {backLink}
            <DisputeDetailView dispute={dispute} viewer={viewer}>
                {needsSellerResponse && <SellerRespondPanel dispute={dispute} onUpdated={(updated) => setState({ kind: "ready", dispute: updated })} />}
                {needsDecision && <AdminDisputeDecision dispute={dispute} onUpdated={(updated) => setState({ kind: "ready", dispute: updated })} />}

                {/* The seller's response and the administrator's decision are themselves messages in the
                    conversation, so a second message box is not shown beside them. An administrator can
                    still ask a question without deciding, from the folded section. */}
                {canAppeal && (
                    <section aria-labelledby="appeal-heading" className="card summary-card">
                        <h2 id="appeal-heading">Appeal this decision</h2>
                        <p>
                            If you think Vendly got this wrong, tell us why and we will look at it again.
                            {dispute.appeal?.deadline && <> You can appeal until {formatShortDate(dispute.appeal.deadline)}.</>}
                        </p>
                        <Notice kind="warning">You can appeal once, and the second decision is final.</Notice>
                        <DisputeMessageForm
                            label="Why should we look again?"
                            submitLabel="Send appeal"
                            onSend={(message, urls) => runAction(() => appealDispute(dispute.id, message, urls))}
                        />
                    </section>
                )}

                {canReopen && <ReopenDisputePanel dispute={dispute} onUpdated={(updated) => setState({ kind: "ready", dispute: updated })} />}

                {isClosed ? (
                    <Notice kind="info">
                        {dispute.status === "WITHDRAWN"
                            ? "This was withdrawn, so it is closed."
                            : dispute.appeal?.appealed
                                ? "This was appealed and decided again. The second decision is final."
                                : "This has been decided and is closed."}
                    </Notice>
                ) : needsSellerResponse ? null : needsDecision ? (
                    <details className="card summary-card admin-issue">
                        <summary>Message the buyer and seller without deciding</summary>
                        {messageForm}
                    </details>
                ) : (
                    <section aria-labelledby="reply-heading" className="card summary-card">
                        <h2 id="reply-heading">Write a message</h2>
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
                    </section>
                )}
            </DisputeDetailView>
        </div>
    )
}

export default DisputeDetailPage
