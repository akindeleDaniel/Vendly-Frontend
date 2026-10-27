import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, CalendarDays, ChevronRight, PackageCheck, RotateCcw, ShoppingBag, Star, Truck } from "lucide-react"
import { OrderItemRow, OrderNote, OrderProgress } from "../components/BuyerOrderParts"
import ConfirmReceiptPrompt from "../components/ConfirmReceiptPrompt"
import Notice from "../components/Notice"
import ShopAvatar from "../components/ShopAvatar"
import { SHORT_COMPLAINT_REASONS, buyerProgressSteps, describeBuyerStatus, formatOrderDay, hasProgress } from "../lib/buyerOrders"
import { describeDispute } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { fetchAwaitingConfirmationCount, fetchMyOrders, formatProvider } from "../lib/orderApi"
import type { OrderOutcome } from "../lib/orderApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { CustomerOrder, CustomerOrderSummary, MyOrderFilter, MyOrderPage } from "../types/order"

type SellerOrder = CustomerOrderSummary["sellerOrders"][number]

const FILTERS: Array<{ value: MyOrderFilter, label: string }> = [
    { value: "all", label: "All" },
    { value: "progress", label: "In progress" },
    { value: "delivered", label: "Delivered" },
    { value: "issues", label: "Refunds and complaints" }
]

function readFilter(value: string | null): MyOrderFilter {
    return FILTERS.find((filter) => filter.value === value)?.value ?? "all"
}

function readPage(value: string | null): number {
    const page = Number(value)
    return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

type ShopOrderProps = {
    checkoutId: number
    paidAt: string | null
    sellerOrder: SellerOrder
    onConfirmed: (order: CustomerOrder) => void
}

// One shop's part of an order: what was bought, where it is, and what the buyer can do next.
function ShopOrder({ checkoutId, paidAt, sellerOrder, onConfirmed }: ShopOrderProps) {
    const shop = sellerOrder.seller
    const status = describeBuyerStatus(sellerOrder)
    const hasSteps = hasProgress(sellerOrder)
    const needsConfirm = sellerOrder.status === "SHIPPED" && sellerOrder.deliveryReportedAt !== null
    const isDelivered = sellerOrder.status === "DELIVERED"
    const canReport = sellerOrder.dispute === null && hasSteps
    const itemCount = sellerOrder.itemCount === 1 ? "1 item" : `${sellerOrder.itemCount} items`

    return (
        <section className="orders-shop" aria-label={`${shop?.businessName ?? "Shop"}: ${status.label}`}>
            <div className="orders-shop-head">
                <ShopAvatar name={shop?.businessName} logoUrl={shop?.logoUrl} brandColor={shop?.brandColor} />
                <div className="orders-shop-name">
                    {shop ? <Link to={`/shop/${encodeURIComponent(shop.slug)}`}>{shop.businessName}</Link> : "Shop"}
                    <span> · {itemCount}</span>
                </div>
                <span className={`orders-status is-${status.tone}`}>{status.label}</span>
            </div>

            <div className={`orders-shop-body${hasSteps ? "" : " is-single"}`}>
                <ul className="orders-items">
                    {sellerOrder.items.map((item, index) => <OrderItemRow key={`${item.listingId}-${index}`} item={item} />)}
                </ul>
                {hasSteps && <OrderProgress steps={buyerProgressSteps(sellerOrder, paidAt)} />}
            </div>

            {needsConfirm && (
                <ConfirmReceiptPrompt
                    checkoutId={checkoutId}
                    sellerOrderId={sellerOrder.id}
                    shopName={shop?.businessName}
                    reportedAt={sellerOrder.deliveryReportedAt}
                    canReport={canReport}
                    onConfirmed={onConfirmed}
                />
            )}

            {sellerOrder.status === "PAID" && sellerOrder.fulfilmentType === "PRE_ORDER" && sellerOrder.readyAt && (
                <OrderNote icon={CalendarDays} tone="plain">Pre-order: the shop will have it ready on {formatOrderDay(sellerOrder.readyAt)}.</OrderNote>
            )}

            {sellerOrder.status === "SHIPPED" && !needsConfirm && sellerOrder.shippingNote && (
                <OrderNote icon={Truck} tone="plain">From the shop: {sellerOrder.shippingNote}</OrderNote>
            )}

            {sellerOrder.dispute && (
                <OrderNote icon={AlertTriangle} tone="warning">
                    <span>Complaint: {SHORT_COMPLAINT_REASONS[sellerOrder.dispute.reason] ?? SHORT_COMPLAINT_REASONS.OTHER}. {describeDispute(sellerOrder.dispute, "buyer").label}.</span>
                    <Link to={`/disputes/${sellerOrder.dispute.id}`}>View complaint</Link>
                </OrderNote>
            )}

            {sellerOrder.refunds.map((refund) => (
                <OrderNote key={refund.reference} icon={RotateCcw} tone={refund.status === "SUCCEEDED" ? "good" : "plain"}>
                    {refund.status === "SUCCEEDED"
                        ? `Refund of ${formatNaira(refund.amount)} completed${refund.completedAt ? ` on ${formatOrderDay(refund.completedAt)}` : ""}.`
                        : refund.status === "PENDING" || refund.status === "PROCESSING"
                            ? `Refund of ${formatNaira(refund.amount)} on its way${refund.expectedAt ? `, expected by ${formatOrderDay(refund.expectedAt)}` : ""}.`
                            : `Refund of ${formatNaira(refund.amount)}: StoreHatch is sorting this out and will keep you posted.`}
                    {refund.note && ` ${refund.note}`}
                </OrderNote>
            ))}

            {(isDelivered || (canReport && !needsConfirm)) && (
                <div className="orders-shop-foot">
                    {isDelivered && (
                        <Link to={`/orders/${checkoutId}?review=${sellerOrder.id}`} className="btn">
                            <Star size={16} aria-hidden="true" />Review your order
                        </Link>
                    )}
                    {isDelivered && (
                        <span className="orders-muted">
                            {sellerOrder.deliveryConfirmedAt
                                ? `You confirmed delivery on ${formatOrderDay(sellerOrder.deliveryConfirmedAt)}.`
                                : sellerOrder.deliveryAutoClosedAt ? `Marked delivered on ${formatOrderDay(sellerOrder.deliveryAutoClosedAt)}.` : ""}
                        </span>
                    )}
                    {canReport && !needsConfirm && (
                        <Link to={`/orders/${checkoutId}/seller-orders/${sellerOrder.id}/complaint`} className="orders-report">Report a problem</Link>
                    )}
                </div>
            )}
        </section>
    )
}

// The shopper's paid orders, newest first, with a tab for each kind and one card per checkout.
function MyOrdersPage() {
    useDocumentTitle("My orders")
    const [searchParams, setSearchParams] = useSearchParams()
    const filter = readFilter(searchParams.get("status"))
    const page = readPage(searchParams.get("page"))
    const [outcome, setOutcome] = useState<OrderOutcome<MyOrderPage> | null>(null)
    const [attempt, setAttempt] = useState(0)
    const [awaitingCount, setAwaitingCount] = useState<number | null>(null)
    // The list stays on screen, faded, while the next tab or page loads.
    const requestKey = `${filter}|${page}|${attempt}`
    const [loadedKey, setLoadedKey] = useState("")
    const isLoading = loadedKey !== requestKey

    useEffect(() => {
        const controller = new AbortController()
        fetchMyOrders(page, filter, controller.signal).then((result) => {
            if (!controller.signal.aborted) {
                setOutcome(result)
                setLoadedKey(`${filter}|${page}|${attempt}`)
            }
        })
        return () => controller.abort()
    }, [page, filter, attempt])

    useEffect(() => {
        const controller = new AbortController()
        fetchAwaitingConfirmationCount(controller.signal).then((count) => {
            if (!controller.signal.aborted) {
                setAwaitingCount(count)
            }
        })
        return () => controller.abort()
    }, [attempt])

    function showFilter(value: MyOrderFilter, nextPage = 1) {
        const params = new URLSearchParams()
        if (value !== "all") {
            params.set("status", value)
        }
        if (nextPage > 1) {
            params.set("page", String(nextPage))
        }
        setSearchParams(params)
        window.scrollTo({ top: 0, behavior: "instant" })
    }

    // Shows the confirmation straight away, then reloads quietly so the tabs and counts follow.
    function applyConfirmation(updated: CustomerOrder) {
        setOutcome((current) => current?.kind === "ok"
            ? {
                kind: "ok",
                data: {
                    ...current.data,
                    orders: current.data.orders.map((order) => order.id !== updated.id
                        ? order
                        : {
                            ...order,
                            sellerOrders: order.sellerOrders.map((sellerOrder) => {
                                const fresh = updated.sellerOrders.find((candidate) => candidate.id === sellerOrder.id)
                                return fresh
                                    ? {
                                        ...sellerOrder,
                                        status: fresh.status,
                                        shippedAt: fresh.shippedAt,
                                        shippingNote: fresh.shippingNote,
                                        deliveryReportedAt: fresh.deliveryReportedAt,
                                        deliveryConfirmedAt: fresh.deliveryConfirmedAt,
                                        deliveryAutoClosedAt: fresh.deliveryAutoClosedAt
                                    }
                                    : sellerOrder
                            })
                        })
                }
            }
            : current)
        setAwaitingCount((count) => count === null ? null : Math.max(0, count - 1))
    }

    const header = (
        <div className="orders-head">
            <div>
                <h1>My orders</h1>
                <p>Track what you bought, confirm deliveries and review shops.</p>
            </div>
            <div className="orders-quick">
                <Link to="/disputes"><AlertTriangle size={16} aria-hidden="true" />Complaints</Link>
                <Link to="/pre-orders"><CalendarDays size={16} aria-hidden="true" />Pre-orders</Link>
            </div>
        </div>
    )

    if (outcome === null) {
        return <div className="orders-page" aria-busy="true">{header}<p role="status">Loading your orders...</p></div>
    }

    if (outcome.kind !== "ok") {
        return (
            <div className="orders-page">
                {header}
                <Notice kind="error">
                    <p>{outcome.kind === "error" ? outcome.message : "We could not load your orders."}</p>
                    <button type="button" className="btn" onClick={() => setAttempt((count) => count + 1)}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { orders, total, pageSize, counts } = outcome.data
    const lastPage = Math.max(1, Math.ceil(total / pageSize))
    const hasNoOrders = (counts ? counts.all === 0 : filter === "all" && total === 0)

    if (hasNoOrders) {
        return (
            <div className="orders-page">
                {header}
                <section className="orders-empty" aria-labelledby="orders-empty-title">
                    <span className="orders-empty-icon" aria-hidden="true"><ShoppingBag size={40} strokeWidth={1.8} /></span>
                    <h2 id="orders-empty-title">No orders yet</h2>
                    <p>When you buy from a shop on StoreHatch, your orders show up here. You can follow each delivery, confirm it arrived and review the shop.</p>
                    <div className="orders-empty-actions">
                        <Link to="/" className="btn btn-primary">Start shopping</Link>
                    </div>
                </section>
            </div>
        )
    }

    return (
        <div className="orders-page" aria-busy={isLoading}>
            {header}

            {filter === "all" && awaitingCount !== null && awaitingCount > 0 && (
                <div className="orders-attention" role="status">
                    <span className="orders-attention-icon" aria-hidden="true"><PackageCheck size={18} /></span>
                    <p>
                        <strong>{awaitingCount === 1 ? "1 delivery is waiting for you" : `${awaitingCount} deliveries are waiting for you`}</strong>
                        <span>{awaitingCount === 1 ? "A shop says your order arrived." : "Shops say your orders arrived."} Let them know you got it.</span>
                    </p>
                    <button type="button" className="btn" onClick={() => showFilter("progress")}>Show me</button>
                </div>
            )}

            <div className="orders-filters" aria-label="Show orders">
                {FILTERS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`orders-filter${option.value === filter ? " is-active" : ""}`}
                        aria-pressed={option.value === filter}
                        onClick={() => showFilter(option.value)}
                    >
                        {option.label}
                        {counts && <span className="orders-filter-count">{counts[option.value]}</span>}
                    </button>
                ))}
            </div>

            {orders.length === 0 ? (
                <div className="orders-none">
                    <p>No orders here right now.</p>
                    <button type="button" className="btn" onClick={() => showFilter("all")}>Show all orders</button>
                </div>
            ) : (
                <ul className={`orders-list${isLoading ? " is-loading" : ""}`}>
                    {orders.map((order) => {
                        const paidAt = order.payment?.paidAt ?? order.createdAt
                        const shopCount = order.sellerOrders.length

                        return (
                            <li key={order.id} className="orders-card">
                                <div className="orders-card-head">
                                    <div>
                                        <h2>Order #{order.id}</h2>
                                        <p>Placed {formatOrderDay(order.createdAt, { year: true })} · Paid with {formatProvider(order.payment?.provider)}</p>
                                    </div>
                                    <div className="orders-card-side">
                                        <p className="orders-card-total">
                                            {formatNaira(order.total)}
                                            <span>{shopCount === 1 ? "From 1 shop" : `From ${shopCount} shops`}</span>
                                        </p>
                                        <Link to={`/orders/${order.id}`} className="orders-card-link" aria-label={`View order ${order.id}`}>
                                            View order<ChevronRight size={16} aria-hidden="true" />
                                        </Link>
                                    </div>
                                </div>
                                {order.sellerOrders.map((sellerOrder) => (
                                    <ShopOrder
                                        key={sellerOrder.id}
                                        checkoutId={order.id}
                                        paidAt={paidAt}
                                        sellerOrder={sellerOrder}
                                        onConfirmed={(updated) => {
                                            applyConfirmation(updated)
                                            setAttempt((count) => count + 1)
                                        }}
                                    />
                                ))}
                            </li>
                        )
                    })}
                </ul>
            )}

            {lastPage > 1 && (
                <nav className="orders-pager" aria-label="Pages">
                    <button type="button" className="btn" disabled={page <= 1} onClick={() => showFilter(filter, page - 1)}>Previous</button>
                    <span>Page {page} of {lastPage}</span>
                    <button type="button" className="btn" disabled={page >= lastPage} onClick={() => showFilter(filter, page + 1)}>Next</button>
                </nav>
            )}
        </div>
    )
}

export default MyOrdersPage
