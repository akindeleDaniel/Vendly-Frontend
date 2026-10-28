import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ChevronRight, Flag } from "lucide-react"
import { AdminFilters, AdminListHead, AdminPager, AdminSearch } from "../components/AdminList"
import Notice from "../components/Notice"
import { pageOf } from "../lib/adminDisplay"
import { listAdminOrders } from "../lib/adminLookupApi"
import { formatNaira } from "../lib/money"
import { formatShortDate, hasAmount } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminOrderRow } from "../types/admin"

type StatusFilter = "" | "PAID" | "SHIPPED" | "DELIVERED" | "REFUNDED" | "PENDING_PAYMENT" | "CANCELLED"

// With no status the backend lists paid orders: paid, shipped, delivered and refunded.
const STATUS_FILTERS: Array<{ value: StatusFilter, label: string, noun: string }> = [
    { value: "", label: "Paid orders", noun: "paid orders" },
    { value: "PAID", label: "To ship", noun: "to ship" },
    { value: "SHIPPED", label: "Shipped", noun: "shipped" },
    { value: "DELIVERED", label: "Delivered", noun: "delivered" },
    { value: "REFUNDED", label: "Refunded", noun: "refunded" },
    { value: "PENDING_PAYMENT", label: "Awaiting payment", noun: "awaiting payment" },
    { value: "CANCELLED", label: "Cancelled", noun: "cancelled" }
]

const STATUS_PILLS: Record<string, { label: string, tone: string }> = {
    PAID: { label: "To ship", tone: "attention" },
    SHIPPED: { label: "Shipped", tone: "progress" },
    DELIVERED: { label: "Delivered", tone: "done" },
    REFUNDED: { label: "Refunded", tone: "neutral" },
    PENDING_PAYMENT: { label: "Awaiting payment", tone: "neutral" },
    CANCELLED: { label: "Cancelled", tone: "neutral" }
}

// The latest complaint on an order, in a few words. Withdrawn complaints are not sent.
function complaintFlag(status: string): { label: string, isOpen: boolean } {
    switch (status) {
        case "OPEN": return { label: "Complaint: with the seller", isOpen: true }
        case "SELLER_AGREED":
        case "UNDER_REVIEW": return { label: "Complaint: needs a decision", isOpen: true }
        default: return { label: "Complaint: closed", isOpen: false }
    }
}

function OrderRow({ order }: { order: AdminOrderRow }) {
    const pill = STATUS_PILLS[order.status] ?? { label: order.status, tone: "neutral" }
    const flag = order.complaint ? complaintFlag(order.complaint.status) : null

    return (
        <li>
            <Link to={`/admin/orders/${order.id}`} className="admin-row admin-order-row">
                <span className="admin-cell">
                    <b>Order {order.id}</b>
                    <small>{formatShortDate(order.createdAt)} · Checkout {order.checkoutId}</small>
                </span>
                <span className="admin-cell admin-order-items">
                    <span className="admin-ellipsis">{order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</span>
                    <small>{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</small>
                </span>
                <span className="admin-cell admin-order-who">
                    <span className="admin-ellipsis"><span className="admin-key">Buyer </span>{order.buyer.name}</span>
                    <small className="admin-ellipsis">to {order.seller.businessName ?? order.seller.email}</small>
                </span>
                <span className="admin-cell admin-cell-end">
                    <b>{formatNaira(order.total)}</b>
                    {hasAmount(order.refundedAmount) && <small>{formatNaira(order.refundedAmount)} refunded</small>}
                </span>
                <span className="admin-cell admin-order-status">
                    <span className={`orders-status is-${pill.tone}`}>{pill.label}</span>
                    {flag && <span className={`admin-flag${flag.isOpen ? "" : " is-closed"}`}><Flag size={14} aria-hidden="true" />{flag.label}</span>}
                </span>
                <ChevronRight className="admin-chevron" size={18} aria-hidden="true" />
            </Link>
        </li>
    )
}

// Finds an order when someone phones or emails: by order or checkout number, the buyer's or seller's
// name or email, the shop, the delivery name, or a payment reference. A buyer or seller chosen on a
// person's page narrows the list to that person.
function AdminOrdersPage() {
    useDocumentTitle("Orders")
    const [searchParams, setSearchParams] = useSearchParams()
    const buyerId = searchParams.get("buyerId") ?? ""
    const sellerId = searchParams.get("sellerId") ?? ""
    const initialSearch = searchParams.get("search") ?? ""// from the search box on the Overview
    const [search, setSearch] = useState(initialSearch)
    const [status, setStatus] = useState<StatusFilter>("")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(
        `${search}|${status}|${buyerId}|${sellerId}|${page}`,
        (signal) => listAdminOrders({ search, status, buyerId, sellerId, page }, signal)
    )
    const noun = STATUS_FILTERS.find((filter) => filter.value === status)?.noun ?? "orders"

    return (
        <div className="admin-page">
            <AdminListHead title="Orders" intro="Paid orders, newest first. Open one to see its payments, refunds and complaint." />

            <div className="admin-tools">
                <AdminSearch
                    label="Search orders"
                    placeholder="Order number, name, email, shop or payment reference"
                    initial={initialSearch}
                    onSearch={(term) => { setSearch(term); setPage(1) }}
                />
                <AdminFilters label="Show" options={STATUS_FILTERS} value={status} onChange={(value) => { setStatus(value); setPage(1) }} />
                {(buyerId || sellerId) && (
                    <div className="admin-scope">
                        <span>Showing one {buyerId ? "buyer's" : "seller's"} orders.</span>
                        <button type="button" className="btn-text" onClick={() => { setSearchParams({}); setPage(1) }}>Show everyone's</button>
                    </div>
                )}
            </div>

            {state.kind === "loading" && <p role="status">Searching...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    <p className="admin-count">
                        <span><b>{state.data.total.toLocaleString("en-NG")}</b> {state.data.total === 1 && status === "" ? "paid order" : noun}</span>
                        <span>{pageOf(page, state.data.pageSize, state.data.total)}</span>
                    </p>
                    {state.data.orders.length === 0 ? <div className="orders-none"><p>No orders match.</p></div> : (
                        <div className="admin-panel">
                            <div className="admin-thead admin-order-row" aria-hidden="true">
                                <span>Order</span><span className="admin-order-items">Items</span><span>Buyer and shop</span><span className="admin-cell-end">Total</span><span>Status</span><span />
                            </div>
                            <ul className="admin-rows">
                                {state.data.orders.map((order) => <OrderRow key={order.id} order={order} />)}
                            </ul>
                        </div>
                    )}
                    <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}
        </div>
    )
}

export default AdminOrdersPage
