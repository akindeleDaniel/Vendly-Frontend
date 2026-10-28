import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import { listAdminOrders } from "../lib/adminLookupApi"
import { formatNaira, } from "../lib/money"
import { formatOrderStatus, formatShortDate, hasAmount } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

const STATUS_FILTERS = [
    { value: "", label: "Paid orders" },
    { value: "PAID", label: "Paid" },
    { value: "SHIPPED", label: "Shipped" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "REFUNDED", label: "Refunded" },
    { value: "PENDING_PAYMENT", label: "Awaiting payment" },
    { value: "CANCELLED", label: "Cancelled" }
]

// Finds an order when someone phones or emails: by order or checkout number, the buyer's or seller's
// name or email, the shop, the delivery name, or a payment reference. A buyer or seller chosen on a
// person's page narrows the list to that person.
function AdminOrdersPage() {
    useDocumentTitle("Find an order")
    const [searchParams, setSearchParams] = useSearchParams()
    const buyerId = searchParams.get("buyerId") ?? ""
    const sellerId = searchParams.get("sellerId") ?? ""
    const initialSearch = searchParams.get("search") ?? ""// from the search box on the Overview
    const [searchInput, setSearchInput] = useState(initialSearch)
    const [search, setSearch] = useState(initialSearch)
    const [status, setStatus] = useState("")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(
        `${search}|${status}|${buyerId}|${sellerId}|${page}`,
        (signal) => listAdminOrders({ search, status, buyerId, sellerId, page }, signal)
    )

    function applySearch(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setSearch(searchInput)
        setPage(1)
    }

    return (
        <div>
            <h1>Find an order</h1>

            <form role="search" onSubmit={applySearch} className="search-form">
                <label className="visually-hidden" htmlFor="admin-order-search">Search orders</label>
                <input
                    id="admin-order-search"
                    type="search"
                    maxLength={100}
                    placeholder="Order number, name, email, shop or payment reference"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />
                <button type="submit">Search</button>
            </form>

            <div className="filter-row">
                <label className="field-inline">
                    Show{" "}
                    <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
                        {STATUS_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                    </select>
                </label>
                {(buyerId || sellerId) && (
                    <button type="button" className="btn-text" onClick={() => { setSearchParams({}); setPage(1) }}>
                        Showing one {buyerId ? "buyer's" : "seller's"} orders. Show everyone
                    </button>
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
                    <p className="field-help">{state.data.total} {state.data.total === 1 ? "order" : "orders"} found.</p>
                    {state.data.orders.length === 0 ? <p>No orders match.</p> : (
                        <ul className="order-history">
                            {state.data.orders.map((order) => (
                                <li key={order.id} className="card order-card">
                                    <div className="order-header">
                                        <h2><Link to={`/admin/orders/${order.id}`}>Order {order.id}</Link></h2>
                                        <span className="badge">{formatOrderStatus(order.status)}</span>
                                    </div>
                                    <p className="order-line-meta">
                                        Checkout {order.checkoutId} · {formatShortDate(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                                    </p>
                                    <p className="dispute-items">{order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</p>
                                    <dl className="detail-list">
                                        <div><dt>Buyer</dt><dd><Link to={`/admin/users/${order.buyer.id}`}>{order.buyer.name}</Link>, {order.buyer.email}</dd></div>
                                        <div><dt>Seller</dt><dd><Link to={`/admin/users/${order.seller.id}`}>{order.seller.businessName ?? "No shop"}</Link>, {order.seller.email}</dd></div>
                                        <div><dt>Total</dt><dd>{formatNaira(order.total)}</dd></div>
                                        {hasAmount(order.refundedAmount) && <div><dt>Refunded</dt><dd>{formatNaira(order.refundedAmount)}</dd></div>}
                                        {order.complaint && (
                                            <div><dt>Complaint</dt><dd><Link to={`/admin/complaints/${order.complaint.id}`}>Complaint {order.complaint.id}</Link></dd></div>
                                        )}
                                    </dl>
                                    <div className="action-row">
                                        <Link to={`/admin/orders/${order.id}`} className="btn">View</Link>
                                        <Link to={`/admin/refunds?order=${order.id}`} className="btn">Issue a refund</Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}
        </div>
    )
}

export default AdminOrdersPage
