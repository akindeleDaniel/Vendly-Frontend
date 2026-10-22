import { useState } from "react"
import { Link } from "react-router-dom"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import PreOrderBadge from "../components/PreOrderBadge"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { PRE_ORDER_FILTERS, listPreOrders } from "../lib/preOrderApi"
import type { PreOrderViewer } from "../lib/preOrderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { PreOrderStatus } from "../types/preOrder"

const DETAIL_PATHS: Record<PreOrderViewer, string> = {
    buyer: "/pre-orders",
    seller: "/seller/pre-orders"
}

const INTRO: Record<PreOrderViewer, string> = {
    buyer: "Times you have asked food shops to have your order ready. Nothing is charged until a shop approves and you pay.",
    seller: "Buyers asking you to have an order ready at a set time. You have 48 hours to approve or decline, or the request lapses."
}

// The list of pre-order requests for a buyer or a food shop, newest first.
function PreOrderListPage({ viewer }: { viewer: PreOrderViewer }) {
    useDocumentTitle("Pre-orders")
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState<"" | PreOrderStatus>("")
    const { state, reload } = useApiResource(`${viewer}|${page}|${status}`, (signal) => listPreOrders(viewer, page, status, signal))

    return (
        <div>
            <BackArrow to={viewer === "buyer" ? "/orders" : "/seller/myListing"} label={viewer === "buyer" ? "Back to my orders" : "Back to my store"} />
            <h1>Pre-orders</h1>
            <p>{INTRO[viewer]}</p>

            <label className="field-inline">
                Show{" "}
                <select value={status} onChange={(event) => { setStatus(event.target.value as "" | PreOrderStatus); setPage(1) }}>
                    {PRE_ORDER_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
            </label>

            {state.kind === "loading" && <p role="status">Loading pre-orders...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.preOrders.length === 0 ? <p>No pre-orders here.</p> : (
                        <ul className="order-history">
                            {state.data.preOrders.map((preOrder) => (
                                <li key={preOrder.id} className="card order-card">
                                    <div className="order-header">
                                        <h2><Link to={`${DETAIL_PATHS[viewer]}/${preOrder.id}`}>Pre-order {preOrder.id}</Link></h2>
                                        <PreOrderBadge preOrder={preOrder} viewer={viewer} />
                                    </div>
                                    <p className="order-line-meta">
                                        Ready on {formatShortDate(preOrder.readyAt)} · Asked {formatShortDate(preOrder.createdAt)}
                                    </p>
                                    <p className="dispute-items">{preOrder.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}</p>
                                    <div className="summary-row">
                                        <span>{viewer === "buyer" ? preOrder.seller.businessName : preOrder.buyerName ?? "A buyer"}</span>
                                        <span>{formatNaira(preOrder.subtotal)}</span>
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

export default PreOrderListPage
