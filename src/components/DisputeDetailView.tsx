import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Check, Clock, Lock, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { OrderItemRow, OrderProgress } from "./BuyerOrderParts"
import DisputeThread from "./DisputeThread"
import RefundList from "./RefundList"
import ShopAvatar from "./ShopAvatar"
import { formatOrderDay } from "../lib/buyerOrders"
import type { ProgressStep, StatusTone } from "../lib/buyerOrders"
import { describeDispute, isDisputeClosed } from "../lib/disputeApi"
import type { DisputeViewer } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import DisputeCountdown from "./DisputeCountdown"
import type { Dispute } from "../types/dispute"

type DisputeDetailViewProps = {
    dispute: Dispute
    viewer: DisputeViewer
    children?: ReactNode// the actions this person can take (respond, decide, appeal, reopen)
    composer?: ReactNode// the message box, shown at the end of the conversation
}

const TONE_BY_DISPUTE: Record<string, StatusTone> = { attention: "attention", neutral: "progress", good: "done", bad: "bad" }

// Reported (or offered), the shop's answer, and the decision. A seller's own refund offer has no
// answer from the shop, so it has two steps.
function disputeSteps(dispute: Dispute): ProgressStep[] {
    const day = (isoTime: string | null | undefined) => formatOrderDay(isoTime, { time: true })
    const isClosed = isDisputeClosed(dispute.status)
    const decision: ProgressStep = dispute.status === "RESOLVED"
        ? { label: dispute.outcome === "REFUNDED" ? "Refunded" : "Not approved", detail: day(dispute.resolvedAt), state: dispute.outcome === "REFUNDED" ? "done" : "stopped" }
        : dispute.status === "WITHDRAWN"
            ? { label: "Withdrawn", detail: day(dispute.resolvedAt), state: "stopped" }
            : dispute.status === "OPEN"
                ? { label: "Settled", detail: "Not yet", state: "next" }
                : { label: "StoreHatch decides", detail: "In progress", state: "waiting" }

    if (dispute.openedBy === "SELLER") {
        return [{ label: "Refund offered", detail: day(dispute.createdAt), state: "done" }, decision]
    }

    const answer: ProgressStep = dispute.sellerRespondedAt
        ? { label: "Shop answered", detail: day(dispute.sellerRespondedAt), state: "done" }
        : dispute.status === "OPEN"
            ? { label: "Shop's answer", detail: dispute.responseDueAt ? `Due ${day(dispute.responseDueAt)}` : "Waiting", state: "waiting" }
            : dispute.escalatedAt
                ? { label: "Shop's answer", detail: "No answer in time", state: "stopped" }
                : { label: "Shop's answer", detail: isClosed ? "—" : "Waiting", state: isClosed ? "next" : "waiting" }

    return [{ label: "Reported", detail: day(dispute.createdAt), state: "done" }, answer, decision]
}

// What happens next, in a sentence, for the person looking at the complaint.
function nextStep(dispute: Dispute, viewer: DisputeViewer): { title: string, text: string, icon: LucideIcon, tone: "act" | "plain" | "good" } {
    const shopName = dispute.seller?.businessName ?? "The shop"
    const due = dispute.responseDueAt ? formatOrderDay(dispute.responseDueAt, { time: true }) : ""

    switch (dispute.status) {
        case "OPEN":
            return viewer === "seller"
                ? { title: "Your answer is needed:", text: `${due ? `Answer by ${due}. ` : ""}Agree to a refund, or explain your side. If you don't answer in time, StoreHatch decides.`, icon: Clock, tone: "act" }
                : { title: "What happens next:", text: `${shopName} ${due ? `has until ${due} to` : "will"} agree to a refund or reply. If they don't answer in time, StoreHatch looks at it and decides.`, icon: Clock, tone: viewer === "buyer" ? "act" : "plain" }
        case "SELLER_AGREED":
            // A seller's own refund offer starts here: it is already agreed and waits for StoreHatch.
            return {
                title: "What happens next:",
                text: dispute.openedBy === "SELLER"
                    ? viewer === "seller" ? "You offered a refund. StoreHatch will confirm it and send it." : `${shopName} offered you a refund. StoreHatch will confirm it and send it.`
                    : viewer === "seller" ? "You agreed to a refund. StoreHatch will confirm it and send it." : "The shop agreed to a refund. StoreHatch will confirm it and send it.",
                icon: Clock,
                tone: "plain"
            }
        case "UNDER_REVIEW":
            return { title: "What happens next:", text: "StoreHatch is looking at both sides and will post the decision here.", icon: Clock, tone: "plain" }
        case "RESOLVED":
            if (dispute.outcome === "REFUNDED") {
                return { title: "Settled:", text: `A refund${dispute.approvedAmount ? ` of ${formatNaira(dispute.approvedAmount)}` : ""} was approved.`, icon: Check, tone: "good" }
            }
            if (viewer === "buyer" && dispute.appeal?.canAppeal) {
                return { title: "You can appeal:", text: `If you think we got this wrong, appeal below${dispute.appeal.deadline ? ` by ${formatOrderDay(dispute.appeal.deadline, { time: true })}` : ""}. You can appeal once.`, icon: AlertTriangle, tone: "act" }
            }
            return {
                title: "Closed:",
                text: dispute.appeal?.appealed ? "This was appealed and decided again. The second decision is final." : "The refund was not approved.",
                icon: Lock,
                tone: "plain"
            }
        case "WITHDRAWN":
            return { title: "Closed:", text: "This was withdrawn.", icon: Lock, tone: "plain" }
    }
}

// One complaint: where it stands, StoreHatch's decision, the conversation, and beside them what was
// asked for, the refunds and the order. The page adds the actions that fit the viewer.
function DisputeDetailView({ dispute, viewer, children, composer }: DisputeDetailViewProps) {
    const isOffer = dispute.openedBy === "SELLER"
    const status = describeDispute(dispute, viewer)
    const next = nextStep(dispute, viewer)
    const NextIcon = next.icon
    const shop = dispute.order.seller ?? dispute.seller
    const shopName = shop?.businessName ?? "Shop"
    const isRefunded = dispute.status === "RESOLVED" && dispute.outcome === "REFUNDED"
    const orderLink = viewer === "seller"
        ? `/seller/orders/${dispute.orderId}`
        : viewer === "buyer" ? `/orders/${dispute.checkoutId}` : `/admin/orders/${dispute.orderId}`

    return (
        <div className="complaint-detail">
            <div className="complaint-title">
                <h1>{isOffer ? "Refund offer" : "Complaint"} #{dispute.id}</h1>
                <span className={`orders-status is-${TONE_BY_DISPUTE[status.tone]}`}>{status.label}</span>
            </div>
            <p className="complaint-sub">
                {isOffer ? "Refund offered by the shop" : dispute.reasonLabel} · {viewer === "seller" ? dispute.buyerName : shopName} · Opened {formatOrderDay(dispute.createdAt, { year: true, time: true })}
            </p>

            <section className="complaint-progress" aria-label="Where this stands">
                <OrderProgress steps={disputeSteps(dispute)} large />
                <p className={`complaint-next is-${next.tone}`}>
                    <NextIcon size={18} aria-hidden="true" />
                    <span><b>{next.title}</b> {next.text}</span>
                </p>
                {viewer === "seller" && dispute.status === "OPEN" && dispute.responseDueAt && <p className="complaint-row-meta"><DisputeCountdown deadline={dispute.responseDueAt} /></p>}
            </section>

            <div className="complaint-grid">
                <div className="complaint-main">
                    {dispute.status === "RESOLVED" && dispute.decisionNote && (
                        <section className={`complaint-decision ${isRefunded ? "is-good" : "is-bad"}`} aria-labelledby="decision-heading">
                            <h2 id="decision-heading">
                                {isRefunded ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
                                {isRefunded
                                    ? `Refund approved${dispute.approvedAmount ? `: ${formatNaira(dispute.approvedAmount)}` : ""}`
                                    : "StoreHatch's decision: refund not approved"}
                            </h2>
                            <p>{dispute.decisionNote}</p>
                            {dispute.resolvedAt && <span className="orders-muted">Decided {formatOrderDay(dispute.resolvedAt, { year: true, time: true })}</span>}
                        </section>
                    )}

                    {children}

                    <section className="complaint-card" aria-labelledby="dispute-thread-heading">
                        <h2 id="dispute-thread-heading">Conversation</h2>
                        <DisputeThread messages={dispute.messages} viewer={viewer} names={{ shop: shop?.businessName, buyer: dispute.buyerName }} />
                        {composer}
                    </section>
                </div>

                <aside className="complaint-aside" aria-label={`About this ${isOffer ? "offer" : "complaint"}`}>
                    <section className="order-box">
                        <h2>{isOffer ? "The offer" : viewer === "buyer" ? "What you asked for" : "What was asked for"}</h2>
                        {!isOffer && <div className="order-row"><span>Reason</span><span>{dispute.reasonLabel}</span></div>}
                        <div className="order-row"><span>Order total</span><span>{formatNaira(dispute.orderTotal)}</span></div>
                        <div className="order-row is-total">
                            <span>{isOffer ? "Refund offered" : "Refund asked for"}</span>
                            <span>{dispute.requestedAmount ? formatNaira(dispute.requestedAmount) : "The full order"}</span>
                        </div>
                        {dispute.approvedAmount && (
                            <div className="order-row is-refund"><span>Refund approved</span><span>{formatNaira(dispute.approvedAmount)}</span></div>
                        )}
                    </section>

                    {dispute.refunds.length > 0 && (
                        <section className="order-box" aria-label="Refunds">
                            <RefundList refunds={dispute.refunds} heading={viewer === "buyer" ? "Your refund" : "Refunds"} />
                            {viewer === "buyer" && <p className="order-help">Refunds go back to the card or account you paid with. Banks can take a few days to show it.</p>}
                        </section>
                    )}

                    <section className="order-box">
                        <h2>The order</h2>
                        {viewer === "seller" ? (
                            <p className="order-help">Bought by {dispute.buyerName}</p>
                        ) : (
                            <div className="complaint-shop">
                                <ShopAvatar name={shop?.businessName} logoUrl={shop?.logoUrl} brandColor={shop?.brandColor ?? undefined} />
                                <div>
                                    <b>{shopName}</b>
                                    {shop?.location && <span>{shop.location}</span>}
                                </div>
                            </div>
                        )}
                        <ul className="orders-items">
                            {dispute.order.items.map((item, index) => <OrderItemRow key={`${item.title}-${index}`} item={item} />)}
                        </ul>
                        <Link to={orderLink} className="order-help-link">View order #{viewer === "buyer" ? dispute.checkoutId : dispute.orderId}</Link>
                        {viewer === "admin" && dispute.buyer && <p className="order-help">Buyer: {dispute.buyerName}, {dispute.buyer.email}</p>}
                        {viewer === "admin" && dispute.sellerContact && <p className="order-help">Seller email: {dispute.sellerContact.email}</p>}
                    </section>

                    {viewer === "buyer" && (
                        <section className="order-box">
                            <h2>How this works</h2>
                            <p className="order-help">
                                The shop has 3 days to agree to a refund or reply. If they disagree or don't answer, StoreHatch looks at both
                                sides and decides. You can appeal a rejection once, within 7 days.
                            </p>
                        </section>
                    )}
                </aside>
            </div>
        </div>
    )
}

export default DisputeDetailView
