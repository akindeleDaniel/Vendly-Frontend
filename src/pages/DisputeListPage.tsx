import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import DisputeBadge from "../components/DisputeBadge"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import { DISPUTE_FILTERS, listDisputes } from "../lib/disputeApi"
import type { DisputeViewer } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { DisputePage } from "../types/dispute"

const DETAIL_PATHS: Record<DisputeViewer, string> = {
    buyer: "/disputes",
    seller: "/seller/disputes",
    admin: "/admin/complaints"
}

const INTRO: Record<DisputeViewer, string> = {
    buyer: "Problems you have reported with your orders, and where each one stands.",
    seller: "Complaints from buyers about your orders, and the refunds you have offered. Answer them quickly: Vendly decides complaints that go unanswered.",
    admin: "Complaints that need a decision are shown first. Choose a status to see the others."
}

type ListState =
    | { kind: "loading" }
    | { kind: "ready", data: DisputePage }
    | { kind: "error", message: string }

// The list of complaints for the buyer, the seller or an administrator, newest first.
function DisputeListPage({ viewer }: { viewer: DisputeViewer }) {
    useDocumentTitle("Complaints")
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState("")
    const [state, setState] = useState<ListState>({ kind: "loading" })
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()

        listDisputes(viewer, page, status, controller.signal).then((result) => {
            if (controller.signal.aborted) {
                return
            }

            if (result.kind === "ok") {
                setState({ kind: "ready", data: result.data })
            } else if (result.kind !== "unauthorized") {
                setState({ kind: "error", message: failureMessage(result) })
            }
        })

        return () => controller.abort()
    }, [viewer, page, status, attempt])

    function changeStatus(next: string) {
        setState({ kind: "loading" })
        setStatus(next)
        setPage(1)
    }

    function goToPage(next: number) {
        setState({ kind: "loading" })
        setPage(next)
    }

    // With no status chosen the backend shows an administrator only the complaints that need a decision.
    const filters = viewer === "admin"
        ? [{ value: "", label: "Needs a decision" }, ...DISPUTE_FILTERS.filter((filter) => filter.value !== "")]
        : DISPUTE_FILTERS

    return (
        <div>
            <h1>Complaints</h1>
            <p>{INTRO[viewer]}</p>

            <label className="field-inline">
                Show{" "}
                <select value={status} onChange={(event) => changeStatus(event.target.value)}>
                    {filters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
            </label>

            {state.kind === "loading" && <p role="status">Loading complaints...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((count) => count + 1) }}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.disputes.length === 0 ? (
                        <p>{status === "" && viewer === "admin" ? "Nothing needs a decision right now." : status === "" ? "There are no complaints." : "No complaints here."}</p>
                    ) : (
                        <ul className="order-history">
                            {state.data.disputes.map((dispute) => (
                                <li key={dispute.id} className="card order-card">
                                    <div className="order-header">
                                        <h2>
                                            <Link to={`${DETAIL_PATHS[viewer]}/${dispute.id}`}>
                                                {dispute.openedBy === "SELLER" ? "Refund offer" : "Complaint"} {dispute.id}
                                            </Link>
                                        </h2>
                                        <DisputeBadge dispute={dispute} viewer={viewer} />
                                    </div>
                                    <p className="order-line-meta">
                                        {dispute.reasonLabel} · Order {dispute.orderId} · {formatShortDate(dispute.createdAt)}
                                    </p>
                                    <p className="dispute-items">
                                        {dispute.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}
                                    </p>
                                    <div className="summary-row">
                                        <span>{viewer === "buyer" ? dispute.seller?.businessName ?? "Seller" : dispute.buyerName}</span>
                                        <span>{dispute.requestedAmount ? formatNaira(dispute.requestedAmount) : `Full order, ${formatNaira(dispute.orderTotal)}`}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {state.data.total > state.data.pageSize && (
                        <div className="action-row">
                            <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1}>Previous</button>
                            <span>Page {page} of {Math.ceil(state.data.total / state.data.pageSize)}</span>
                            <button type="button" onClick={() => goToPage(page + 1)} disabled={page * state.data.pageSize >= state.data.total}>Next</button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default DisputeListPage
