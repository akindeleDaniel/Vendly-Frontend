import { useEffect, useId, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CircleAlert, ShoppingBag, Truck } from "lucide-react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { fetchSellerEarnings } from "../lib/adminLookupApi"
import { formatOrderDay } from "../lib/buyerOrders"
import { describeDispute, fetchComplaintsAwaitingSeller } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { fetchSellerOrders } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { canReportDelivered, canShip, describeSellerStatus, useFulfilmentAction } from "../lib/sellerOrders"
import type { FulfilmentUpdate } from "../lib/sellerOrders"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { OrderItem, OrderPage, SellerOrderSummary } from "../types/order"

const TABS = [
    { value: "", label: "All" },
    { value: "PAID", label: "To ship" },
    { value: "SHIPPED", label: "Shipped" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "REFUNDED", label: "Refunded" }
]

const MAX_THUMBNAILS = 3

function describeItem(item: OrderItem): string {
    const options = [item.optionLabel, item.sizeLabel].filter(Boolean).join(", ")
    return `${item.productTitle ?? item.title}${options ? ` (${options})` : ""} × ${item.quantity}`
}

type RowProps = {
    order: SellerOrderSummary
    onUpdated: (update: FulfilmentUpdate) => void
}

// One order in the list: what was bought and by whom, what the seller receives, and the next step
// (ship it, or mark it delivered) without opening the order.
function SellerOrderRow({ order, onUpdated }: RowProps) {
    const noteId = useId()
    const [isShipOpen, setIsShipOpen] = useState(false)
    const [note, setNote] = useState("")
    const action = useFulfilmentAction(order.id, onUpdated)
    const status = describeSellerStatus(order)
    const photos = order.items.map((item) => item.imageUrl).filter((url): url is string => Boolean(url))
    const extraPhotos = Math.max(0, order.items.length - MAX_THUMBNAILS)
    const isWaiting = order.status === "SHIPPED" && order.deliveryReportedAt !== null
    const shownItems = order.items.slice(0, 3).map(describeItem).join(", ") + (order.items.length > 3 ? `, and ${order.items.length - 3} more` : "")

    async function confirmShipped() {
        if (await action.ship(note)) {
            setIsShipOpen(false)
            setNote("")
        }
    }

    return (
        <li className="seller-order">
            <div className="seller-order-row">
                <div className="seller-order-thumbs" aria-hidden="true">
                    {photos.length === 0
                        ? <span className="seller-order-thumb is-empty"><ShoppingBag size={20} /></span>
                        : photos.slice(0, MAX_THUMBNAILS).map((url, index) => <img key={`${url}-${index}`} className="seller-order-thumb" src={url} alt="" loading="lazy" />)}
                    {extraPhotos > 0 && <span className="seller-order-thumb is-more">+{extraPhotos}</span>}
                </div>
                <div className="seller-order-body">
                    <div className="seller-order-top">
                        <Link to={`/seller/orders/${order.id}`}>Order #{order.id}</Link>
                        <span className={`orders-status is-${status.tone}`}>{status.label}</span>
                    </div>
                    <p className="seller-order-meta">
                        {order.delivery.fullName} · {order.delivery.lga}, {order.delivery.state} · Paid {formatOrderDay(order.paidAt ?? order.createdAt, { time: true })}
                    </p>
                    <p className="seller-order-items">{shownItems}</p>
                    {((order.fulfilmentType === "PRE_ORDER" && order.readyAt && order.status === "PAID") || order.dispute) && (
                        <p className="seller-order-tags">
                            {order.fulfilmentType === "PRE_ORDER" && order.readyAt && order.status === "PAID" && (
                                <span className="seller-order-tag is-preorder">Pre-order: ready by {formatOrderDay(order.readyAt, { time: true })}</span>
                            )}
                            {order.dispute && (
                                <Link to={`/seller/disputes/${order.dispute.id}`} className="seller-order-tag is-complaint">
                                    Complaint: {describeDispute(order.dispute, "seller").label.toLowerCase()}
                                </Link>
                            )}
                        </p>
                    )}
                </div>
                <div className="seller-order-side">
                    <p className="seller-order-money">
                        <b>{order.sellerReceives !== null ? formatNaira(order.sellerReceives) : formatNaira(order.total)}</b>
                        <span>{order.sellerReceives !== null ? `You receive, of ${formatNaira(order.total)} paid` : "Paid. Fee not reported yet"}</span>
                    </p>
                    {canShip(order) && (
                        <button type="button" className="btn btn-primary" aria-expanded={isShipOpen} aria-controls={`${noteId}-panel`} onClick={() => setIsShipOpen((open) => !open)}>
                            <Truck size={16} aria-hidden="true" />Mark as shipped
                        </button>
                    )}
                    {order.status === "SHIPPED" && canReportDelivered(order) && (
                        <button type="button" className="btn" disabled={action.isWorking} onClick={() => action.reportDelivered()}>
                            {action.isWorking ? "Saving..." : "Mark as delivered"}
                        </button>
                    )}
                    {isWaiting && <span className="seller-order-waiting">Waiting for the buyer to confirm they got it.</span>}
                </div>
            </div>
            {action.error && !isShipOpen && <div className="seller-order-error"><Notice kind="error">{action.error}</Notice></div>}
            {isShipOpen && (
                <div className="seller-order-ship" id={`${noteId}-panel`}>
                    <label htmlFor={noteId}>Courier and tracking number <span>(optional, the buyer sees this)</span></label>
                    <div className="seller-order-ship-row">
                        <input
                            id={noteId}
                            className="product-input"
                            maxLength={200}
                            placeholder="For example: GIG Logistics, waybill GL-22841"
                            value={note}
                            disabled={action.isWorking}
                            onChange={(event) => setNote(event.target.value)}
                        />
                        <button type="button" className="btn btn-primary" disabled={action.isWorking} onClick={confirmShipped}>
                            {action.isWorking ? "Saving..." : "Confirm shipped"}
                        </button>
                        <button type="button" className="btn" disabled={action.isWorking} onClick={() => setIsShipOpen(false)}>Cancel</button>
                    </div>
                    {action.error && <Notice kind="error">{action.error}</Notice>}
                    <p className="seller-order-hint">We tell the buyer it's on the way. When it arrives, mark it delivered here.</p>
                </div>
            )}
        </li>
    )
}

// The seller's paid orders, newest first, in tabs by where each one is, with the next step on each.
function SellerOrdersPage() {
    useDocumentTitle("Orders")
    const [searchParams, setSearchParams] = useSearchParams()
    const status = TABS.find((tab) => tab.value === searchParams.get("status"))?.value ?? ""
    const withComplaint = searchParams.get("complaint") === "any"
    const pageParam = Number(searchParams.get("page"))
    const page = Number.isSafeInteger(pageParam) && pageParam >= 1 ? pageParam : 1
    const [outcome, setOutcome] = useState<OrderOutcome<OrderPage<SellerOrderSummary>> | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [counts, setCounts] = useState<Record<string, number> | null>(null)
    const [complaintsToAnswer, setComplaintsToAnswer] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        fetchSellerOrders(page, status, withComplaint ? "any" : "", controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
            }
        })
        return () => controller.abort()
    }, [page, status, withComplaint, attempt])

    // The number on each tab comes from the earnings summary, which counts orders by status.
    useEffect(() => {
        const controller = new AbortController()
        fetchSellerEarnings("", "", controller.signal).then((result) => {
            if (!controller.signal.aborted && result.kind === "ok") {
                setCounts(result.data.ordersByStatus)
            }
        })
        fetchComplaintsAwaitingSeller(controller.signal).then((count) => {
            if (!controller.signal.aborted) {
                setComplaintsToAnswer(count ?? 0)
            }
        })
        return () => controller.abort()
    }, [attempt])

    function show(next: { status?: string, complaint?: boolean, page?: number }) {
        const params = new URLSearchParams()
        const nextStatus = next.status ?? status
        const nextComplaint = next.complaint ?? withComplaint
        if (nextStatus) params.set("status", nextStatus)
        if (nextComplaint) params.set("complaint", "any")
        if (next.page && next.page > 1) params.set("page", String(next.page))
        setOutcome(null)
        setSearchParams(params)
        window.scrollTo({ top: 0, behavior: "instant" })
    }

    // Applies one order's new status and dates to the list, and refreshes the counts on the tabs.
    function applyUpdate(orderId: number, update: FulfilmentUpdate) {
        setOutcome((current) => current?.kind === "ok"
            ? { kind: "ok", data: { ...current.data, orders: current.data.orders.map((order) => order.id === orderId ? { ...order, ...update } : order) } }
            : current)
        fetchSellerEarnings("", "").then((result) => {
            if (result.kind === "ok") {
                setCounts(result.data.ordersByStatus)
            }
        })
    }

    function countFor(value: string): number | null {
        if (!counts) {
            return null
        }
        return value === "" ? Object.values(counts).reduce((sum, count) => sum + count, 0) : counts[value] ?? 0
    }

    return (
        <div className="seller-orders-page">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="complaints-head">
                <h1>Orders</h1>
                <p>Paid orders from your shop. Ship them, then mark them delivered when they arrive.</p>
            </div>

            {complaintsToAnswer > 0 && (
                <div className="seller-orders-alert" role="status">
                    <span className="seller-orders-alert-icon" aria-hidden="true"><CircleAlert size={18} /></span>
                    <p>
                        <strong>{complaintsToAnswer === 1 ? "1 complaint is waiting for your answer" : `${complaintsToAnswer} complaints are waiting for your answer`}</strong>
                        <span>Answer in time, or StoreHatch decides without your side.</span>
                    </p>
                    <Link to="/seller/disputes?group=open" className="btn">Answer {complaintsToAnswer === 1 ? "it" : "them"}</Link>
                </div>
            )}

            <div className="seller-orders-bar">
                <div className="orders-filters" aria-label="Show orders">
                    {TABS.map((tab) => {
                        const count = countFor(tab.value)
                        return (
                            <button
                                key={tab.value}
                                type="button"
                                className={`orders-filter${tab.value === status ? " is-active" : ""}`}
                                aria-pressed={tab.value === status}
                                onClick={() => show({ status: tab.value })}
                            >
                                {tab.label}
                                {count !== null && <span className="orders-filter-count">{count}</span>}
                            </button>
                        )
                    })}
                </div>
                <button type="button" className={`seller-orders-chip${withComplaint ? " is-on" : ""}`} aria-pressed={withComplaint} onClick={() => show({ complaint: !withComplaint })}>
                    <CircleAlert size={16} aria-hidden="true" />With a complaint
                </button>
            </div>

            {outcome === null && <p role="status">Loading orders...</p>}
            {outcome?.kind === "unauthorized" && <Notice kind="warning">Your session has ended. Please log in again to see your orders.</Notice>}
            {(outcome?.kind === "error" || outcome?.kind === "not-found") && (
                <Notice kind="error">
                    <p>{outcome.kind === "error" ? outcome.message : "We could not load your orders. Please try again."}</p>
                    <button type="button" className="btn" onClick={() => { setOutcome(null); setAttempt((count) => count + 1) }}>Try again</button>
                </Notice>
            )}
            {outcome?.kind === "ok" && (
                <>
                    {outcome.data.orders.length === 0 ? (
                        <div className="orders-none">
                            <p>{status === "" && !withComplaint ? "No orders yet. When someone buys from your shop, the order shows up here." : "No orders here."}</p>
                        </div>
                    ) : (
                        <ul className="seller-order-list">
                            {outcome.data.orders.map((order) => (
                                <SellerOrderRow key={order.id} order={order} onUpdated={(update) => applyUpdate(order.id, update)} />
                            ))}
                        </ul>
                    )}
                    {outcome.data.total > outcome.data.pageSize && (
                        <nav className="orders-pager" aria-label="Pages">
                            <button type="button" className="btn" onClick={() => show({ page: page - 1 })} disabled={page <= 1}>Previous</button>
                            <span>Page {page} of {Math.ceil(outcome.data.total / outcome.data.pageSize)}</span>
                            <button type="button" className="btn" onClick={() => show({ page: page + 1 })} disabled={page * outcome.data.pageSize >= outcome.data.total}>Next</button>
                        </nav>
                    )}
                </>
            )}
        </div>
    )
}

export default SellerOrdersPage
