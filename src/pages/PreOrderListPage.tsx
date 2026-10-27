import { Link, useSearchParams } from "react-router-dom"
import { ArrowLeft, CalendarCheck, Check, Clock, CreditCard, ShoppingBag, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import ReadyTile from "../components/ReadyTile"
import { formatOrderDay, readyTimeParts } from "../lib/buyerOrders"
import type { StatusTone } from "../lib/buyerOrders"
import { formatNaira } from "../lib/money"
import { PRE_ORDER_TABS, canPayNow, describePreOrder, listPreOrders, readyTileTone } from "../lib/preOrderApi"
import type { PreOrderViewer } from "../lib/preOrderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { PreOrder, PreOrderGroup } from "../types/preOrder"

const DETAIL_PATHS: Record<PreOrderViewer, string> = {
    buyer: "/pre-orders",
    seller: "/seller/pre-orders"
}

const INTRO: Record<PreOrderViewer, string> = {
    buyer: "Food you asked a shop to have ready at a set time. When a shop approves, pay before the deadline to lock it in.",
    seller: "Buyers asking you to have an order ready at a set time. You have 48 hours to approve or decline, or the request lapses."
}

const TONE_BY_PRE_ORDER: Record<string, StatusTone> = { attention: "attention", neutral: "neutral", good: "done", bad: "neutral" }

// The line under a pre-order saying what happens next, for the person looking at it.
function nextStep(preOrder: PreOrder, viewer: PreOrderViewer): { text: string, icon: LucideIcon, tone: "plain" | "act" | "good" } {
    const shopName = preOrder.seller.businessName ?? "The shop"
    const buyerName = preOrder.buyerName ?? "The buyer"
    const by = (isoTime: string | null) => isoTime ? formatOrderDay(isoTime, { time: true }) : ""

    switch (preOrder.status) {
        case "REQUESTED":
            return viewer === "seller"
                ? { text: preOrder.respondBy ? `Answer by ${by(preOrder.respondBy)}, or the request lapses.` : "Waiting for your answer.", icon: Clock, tone: "act" }
                : { text: `${shopName} ${preOrder.respondBy ? `has until ${by(preOrder.respondBy)} to answer` : "will answer soon"}. Nothing is charged until you pay.`, icon: Clock, tone: "plain" }
        case "APPROVED":
            return viewer === "seller"
                ? { text: `Approved. ${buyerName} ${preOrder.payBy ? `has until ${by(preOrder.payBy)} to pay` : "can now pay"}.`, icon: CreditCard, tone: "plain" }
                : { text: `Approved. Pay${preOrder.payBy ? ` by ${by(preOrder.payBy)}` : ""} to confirm it.`, icon: CreditCard, tone: "act" }
        case "USED":
            return { text: viewer === "seller" ? "Paid. It is now an order with this ready time." : "Paid. It is now an order with this ready time, in My orders.", icon: Check, tone: "good" }
        case "DECLINED":
            return viewer === "seller"
                ? { text: "You declined this request.", icon: X, tone: "plain" }
                : { text: preOrder.sellerNote ? `Declined: “${preOrder.sellerNote}”` : "Declined. You can ask again for another time.", icon: X, tone: "plain" }
        case "EXPIRED":
            return {
                text: preOrder.decidedAt
                    ? viewer === "seller" ? "Not paid in time, so it lapsed." : "Approved but not paid in time, so it lapsed. You weren't charged."
                    : viewer === "seller" ? "Not answered in time, so it lapsed." : "The shop didn't answer in time, so this lapsed. You weren't charged.",
                icon: Clock,
                tone: "plain"
            }
        case "CANCELLED":
            return { text: viewer === "seller" ? "The buyer cancelled this request." : "You cancelled this request.", icon: X, tone: "plain" }
    }
}

function PreOrderRow({ preOrder, viewer }: { preOrder: PreOrder, viewer: PreOrderViewer }) {
    const status = describePreOrder(preOrder, viewer)
    const next = nextStep(preOrder, viewer)
    const NextIcon = next.icon
    const photo = preOrder.items.find((item) => item.imageUrl)?.imageUrl
    const ended = readyTileTone(preOrder) === "ended" && preOrder.status !== "USED"
    const ready = readyTimeParts(preOrder.readyAt)

    return (
        <li className="preorder-row">
            <ReadyTile preOrder={preOrder} />
            <div className="preorder-row-body">
                <div className="complaint-row-top">
                    <Link to={`${DETAIL_PATHS[viewer]}/${preOrder.id}`} className="preorder-row-title">
                        {viewer === "buyer" ? preOrder.seller.businessName ?? "Shop" : preOrder.buyerName ?? "A buyer"}
                        <span className="visually-hidden">, {ended ? "was for" : "ready"} {ready.long}</span>
                    </Link>
                    <span className={`orders-status is-${TONE_BY_PRE_ORDER[status.tone]}`}>{status.label}</span>
                </div>
                <div className="preorder-row-items">
                    {photo
                        ? <img src={photo} alt="" loading="lazy" />
                        : <span className="preorder-row-photo" aria-hidden="true"><ShoppingBag size={18} /></span>}
                    <span>{preOrder.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</span>
                </div>
                <p className="complaint-row-meta">
                    Pre-order #{preOrder.id} · {formatNaira(preOrder.subtotal)} before delivery · Asked {formatOrderDay(preOrder.createdAt)}
                </p>
                <div className={`complaint-next is-${next.tone}`}>
                    <NextIcon size={16} aria-hidden="true" />
                    <span>{next.text}</span>
                    {viewer === "buyer" && canPayNow(preOrder) && <Link to="/checkout" className="btn btn-primary">Pay now</Link>}
                </div>
            </div>
        </li>
    )
}

// The list of pre-order requests for a buyer or a food shop, newest first, in tabs by where they stand.
function PreOrderListPage({ viewer }: { viewer: PreOrderViewer }) {
    useDocumentTitle("Pre-orders")
    const [searchParams, setSearchParams] = useSearchParams()
    const group = PRE_ORDER_TABS.find((tab) => tab.value === searchParams.get("group"))?.value ?? "all"
    const pageParam = Number(searchParams.get("page"))
    const page = Number.isSafeInteger(pageParam) && pageParam >= 1 ? pageParam : 1
    const { state, reload } = useApiResource(`${viewer}|${page}|${group}`, (signal) => listPreOrders(viewer, page, group, signal))

    function show(nextGroup: PreOrderGroup, nextPage = 1) {
        const params = new URLSearchParams()
        if (nextGroup !== "all") {
            params.set("group", nextGroup)
        }
        if (nextPage > 1) {
            params.set("page", String(nextPage))
        }
        setSearchParams(params)
        window.scrollTo({ top: 0, behavior: "instant" })
    }

    const counts = state.kind === "ready" ? state.data.counts : undefined
    const awaitingPayment = state.kind === "ready" ? state.data.awaitingPayment ?? 0 : 0

    return (
        <div className="complaints-page">
            <Link to={viewer === "buyer" ? "/orders" : "/seller/myListing"} className="order-back">
                <ArrowLeft size={18} aria-hidden="true" />{viewer === "buyer" ? "My orders" : "My store"}
            </Link>
            <div className="complaints-head">
                <h1>Pre-orders</h1>
                <p>{INTRO[viewer]}</p>
            </div>

            {viewer === "buyer" && group === "all" && awaitingPayment > 0 && (
                <div className="orders-attention" role="status">
                    <span className="orders-attention-icon" aria-hidden="true"><CalendarCheck size={18} /></span>
                    <p>
                        <strong>{awaitingPayment === 1 ? "1 pre-order is waiting for payment" : `${awaitingPayment} pre-orders are waiting for payment`}</strong>
                        <span>A shop approved your request. Pay before the deadline or the approval lapses.</span>
                    </p>
                    <button type="button" className="btn" onClick={() => show("to-pay")}>Show me</button>
                </div>
            )}

            <div className="orders-filters" aria-label="Show pre-orders">
                {PRE_ORDER_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        className={`orders-filter${tab.value === group ? " is-active" : ""}`}
                        aria-pressed={tab.value === group}
                        onClick={() => show(tab.value)}
                    >
                        {tab.label}
                        {counts && <span className="orders-filter-count">{counts[tab.countKey]}</span>}
                    </button>
                ))}
            </div>

            {state.kind === "loading" && <p role="status">Loading pre-orders...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" className="btn" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.preOrders.length === 0 ? (
                        <div className="orders-none">
                            <p>{group === "all" ? "No pre-orders yet." : "No pre-orders here."}</p>
                            {viewer === "buyer" && group === "all" && <p>When a food shop takes pre-orders, you can ask for a ready time at checkout.</p>}
                        </div>
                    ) : (
                        <ul className="complaint-list">
                            {state.data.preOrders.map((preOrder) => <PreOrderRow key={preOrder.id} preOrder={preOrder} viewer={viewer} />)}
                        </ul>
                    )}
                    <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={(next) => show(group, next)} />
                </>
            )}

            {viewer === "buyer" && (
                <section className="how-it-works is-four" aria-labelledby="preorders-how">
                    <h2 id="preorders-how">How pre-orders work</h2>
                    <ol>
                        <li><b>Ask</b>At checkout, pick a food shop's items and the time you want them ready.</li>
                        <li><b>The shop answers</b>They approve or decline. Nothing is charged yet.</li>
                        <li><b>Pay to confirm</b>Once approved, pay by the deadline, with the same items and prices.</li>
                        <li><b>Ready on time</b>It becomes an order you can follow in My orders.</li>
                    </ol>
                </section>
            )}
        </div>
    )
}

export default PreOrderListPage
