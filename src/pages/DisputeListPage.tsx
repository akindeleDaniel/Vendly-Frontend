import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Clock, MessageCircle, ShoppingBag } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import { formatOrderDay } from "../lib/buyerOrders"
import type { StatusTone } from "../lib/buyerOrders"
import { DISPUTE_FILTERS, describeDispute, listDisputes } from "../lib/disputeApi"
import type { DisputeViewer } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { DisputeGroup, DisputePage, DisputeSummary } from "../types/dispute"

const DETAIL_PATHS: Record<DisputeViewer, string> = {
    buyer: "/disputes",
    seller: "/seller/disputes",
    admin: "/admin/complaints"
}

const INTRO: Record<DisputeViewer, string> = {
    buyer: "Problems you reported with an order, and where each one stands. To report a new one, open the order and choose Report a problem.",
    seller: "Complaints from buyers about your orders, and the refunds you have offered. Answer them quickly: StoreHatch decides complaints that go unanswered.",
    admin: "Complaints that need a decision are shown first. Choose a status to see the others."
}

const GROUPS: Array<{ value: DisputeGroup, label: string }> = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" }
]

type ListState =
    | { kind: "loading" }
    | { kind: "ready", data: DisputePage }
    | { kind: "error", message: string }

// The status pill's colour for each kind of state.
const TONE_BY_DISPUTE: Record<string, StatusTone> = { attention: "attention", neutral: "progress", good: "done", bad: "bad" }

// The line under a complaint saying what happens next, for the person looking at it.
function nextStep(dispute: DisputeSummary, viewer: DisputeViewer): { text: string, icon: LucideIcon, tone: "plain" | "act" | "good" } {
    const shopName = dispute.seller?.businessName ?? "The shop"
    const due = dispute.responseDueAt ? formatOrderDay(dispute.responseDueAt, { time: true }) : ""

    switch (dispute.status) {
        case "OPEN":
            if (viewer === "seller") {
                return { text: due ? `Answer by ${due}. If you don't, StoreHatch decides without your side.` : "Waiting for your answer.", icon: Clock, tone: "act" }
            }
            return dispute.unread && dispute.lastMessageBy === "SELLER"
                ? { text: `${shopName} replied.${due ? ` They have until ${due} to agree to a refund.` : ""}`, icon: MessageCircle, tone: "plain" }
                : { text: due ? `${shopName} has until ${due} to reply.` : `Waiting for ${shopName} to reply.`, icon: Clock, tone: "plain" }
        case "SELLER_AGREED":
            return { text: viewer === "seller" ? "You agreed to a refund. StoreHatch is confirming it." : "The shop agreed to a refund. StoreHatch is confirming it.", icon: Clock, tone: "plain" }
        case "UNDER_REVIEW":
            return { text: "StoreHatch is looking at both sides and will reply in the conversation.", icon: Clock, tone: "plain" }
        case "RESOLVED":
            return dispute.outcome === "REFUNDED"
                ? { text: `Refund${dispute.approvedAmount ? ` of ${formatNaira(dispute.approvedAmount)}` : ""} approved${dispute.resolvedAt ? ` on ${formatOrderDay(dispute.resolvedAt)}` : ""}.`, icon: Check, tone: "good" }
                : { text: viewer === "buyer" ? "Not approved. Open it to see why, and whether you can appeal." : "Not approved.", icon: AlertTriangle, tone: viewer === "buyer" ? "act" : "plain" }
        case "WITHDRAWN":
            return { text: `Withdrawn${dispute.resolvedAt ? ` on ${formatOrderDay(dispute.resolvedAt)}` : ""}.`, icon: Check, tone: "plain" }
    }
}

function DisputeRow({ dispute, viewer }: { dispute: DisputeSummary, viewer: DisputeViewer }) {
    const status = describeDispute(dispute, viewer)
    const next = nextStep(dispute, viewer)
    const photo = dispute.items.find((item) => item.imageUrl)?.imageUrl
    const who = viewer === "seller" ? dispute.buyerName : dispute.seller?.businessName ?? "Shop"
    const isOffer = dispute.openedBy === "SELLER"
    const NextIcon = next.icon

    return (
        <li>
            <Link to={`${DETAIL_PATHS[viewer]}/${dispute.id}`} className="complaint-row">
                {photo
                    ? <img className="complaint-row-photo" src={photo} alt="" loading="lazy" />
                    : <span className="complaint-row-photo" aria-hidden="true"><ShoppingBag size={22} /></span>}
                <div className="complaint-row-body">
                    <div className="complaint-row-top">
                        <b>{isOffer ? "Refund offered by the shop" : dispute.reasonLabel}</b>
                        {dispute.unread && <span className="complaint-new">New reply</span>}
                        <span className={`orders-status is-${TONE_BY_DISPUTE[status.tone]}`}>{status.label}</span>
                    </div>
                    <p className="complaint-row-meta">
                        {who} · {isOffer ? "Offer" : "Complaint"} #{dispute.id} · Order #{dispute.orderId} · Opened {formatOrderDay(dispute.createdAt)}
                    </p>
                    <p className="complaint-row-meta">
                        {isOffer ? "Refund offered" : "Refund asked for"}:{" "}
                        <b>{dispute.requestedAmount ? formatNaira(dispute.requestedAmount) : `the full order, ${formatNaira(dispute.orderTotal)}`}</b>
                    </p>
                    <p className={`complaint-next is-${next.tone}`}><NextIcon size={16} aria-hidden="true" />{next.text}</p>
                </div>
                <ChevronRight className="complaint-row-chevron" size={20} aria-hidden="true" />
            </Link>
        </li>
    )
}

// The list of complaints for the buyer, the seller or an administrator, newest first. Buyers and
// sellers see them in Open and Closed tabs; an administrator chooses a status.
function DisputeListPage({ viewer }: { viewer: DisputeViewer }) {
    useDocumentTitle("Complaints")
    const [searchParams, setSearchParams] = useSearchParams()
    const isAdmin = viewer === "admin"
    const group = GROUPS.find((option) => option.value === searchParams.get("group"))?.value ?? "all"
    const pageParam = Number(searchParams.get("page"))
    const page = Number.isSafeInteger(pageParam) && pageParam >= 1 ? pageParam : 1
    const [adminStatus, setAdminStatus] = useState("")
    const [state, setState] = useState<ListState>({ kind: "loading" })
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()

        listDisputes(viewer, page, isAdmin ? { status: adminStatus } : { group }, controller.signal).then((result) => {
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
    }, [viewer, isAdmin, page, group, adminStatus, attempt])

    function show(nextGroup: DisputeGroup, nextPage = 1) {
        const params = new URLSearchParams()
        if (nextGroup !== "all") {
            params.set("group", nextGroup)
        }
        if (nextPage > 1) {
            params.set("page", String(nextPage))
        }
        setState({ kind: "loading" })
        setSearchParams(params)
        window.scrollTo({ top: 0, behavior: "instant" })
    }

    // With no status chosen the backend shows an administrator only the complaints that need a decision.
    const adminFilters = [{ value: "", label: "Needs a decision" }, ...DISPUTE_FILTERS.filter((filter) => filter.value !== "")]
    const counts = state.kind === "ready" ? state.data.counts : undefined

    return (
        <div className="complaints-page">
            {viewer === "buyer" && <Link to="/orders" className="order-back"><ArrowLeft size={18} aria-hidden="true" />My orders</Link>}
            <div className="complaints-head">
                <h1>Complaints</h1>
                <p>{INTRO[viewer]}</p>
            </div>

            {isAdmin ? (
                <label className="field-inline">
                    Show{" "}
                    <select value={adminStatus} onChange={(event) => { setState({ kind: "loading" }); setAdminStatus(event.target.value); setSearchParams({}) }}>
                        {adminFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                    </select>
                </label>
            ) : (
                <div className="orders-filters" aria-label="Show complaints">
                    {GROUPS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`orders-filter${option.value === group ? " is-active" : ""}`}
                            aria-pressed={option.value === group}
                            onClick={() => show(option.value)}
                        >
                            {option.label}
                            {counts && <span className="orders-filter-count">{counts[option.value]}</span>}
                        </button>
                    ))}
                </div>
            )}

            {state.kind === "loading" && <p role="status">Loading complaints...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" className="btn" onClick={() => { setState({ kind: "loading" }); setAttempt((count) => count + 1) }}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.disputes.length === 0 ? (
                        <div className="orders-none">
                            <p>
                                {isAdmin
                                    ? adminStatus === "" ? "Nothing needs a decision right now." : "No complaints here."
                                    : group === "open" ? "Nothing open right now." : group === "closed" ? "No closed complaints." : "There are no complaints."}
                            </p>
                            {viewer === "buyer" && group === "all" && <p>If something goes wrong with an order, open it from My orders and choose Report a problem.</p>}
                        </div>
                    ) : (
                        <ul className="complaint-list">
                            {state.data.disputes.map((dispute) => <DisputeRow key={dispute.id} dispute={dispute} viewer={viewer} />)}
                        </ul>
                    )}
                    {state.data.total > state.data.pageSize && (
                        <nav className="orders-pager" aria-label="Pages">
                            <button type="button" className="btn" onClick={() => show(group, page - 1)} disabled={page <= 1}>Previous</button>
                            <span>Page {page} of {Math.ceil(state.data.total / state.data.pageSize)}</span>
                            <button type="button" className="btn" onClick={() => show(group, page + 1)} disabled={page * state.data.pageSize >= state.data.total}>Next</button>
                        </nav>
                    )}
                </>
            )}

            {viewer === "buyer" && (
                <section className="how-it-works" aria-labelledby="complaints-how">
                    <h2 id="complaints-how">How complaints work</h2>
                    <ol>
                        <li><b>You report it</b>From the order, with what went wrong, photos and the refund you want.</li>
                        <li><b>The shop answers</b>They have 3 days to agree to a refund or reply. You can message each other here.</li>
                        <li><b>StoreHatch decides if needed</b>If the shop disagrees or doesn't answer, we look at both sides and decide. You can appeal once.</li>
                    </ol>
                </section>
            )}
        </div>
    )
}

export default DisputeListPage
