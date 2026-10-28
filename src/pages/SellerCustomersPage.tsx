import { useState } from "react"
import { Lock } from "lucide-react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import { avatarTone } from "../lib/adminDisplay"
import { formatOrderDay } from "../lib/buyerOrders"
import { fetchSellerCustomers } from "../lib/insightsApi"
import { formatNaira } from "../lib/money"
import { hasAmount } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { CustomerSort } from "../types/insights"

const SORTS: Array<{ value: CustomerSort, label: string }> = [
    { value: "recent", label: "Most recent" },
    { value: "orders", label: "Most orders" },
    { value: "spent", label: "Most spent" }
]

// Everyone who has paid for an order from the shop, from the seller's own orders only. Names show as
// reviews show them; phone numbers and addresses stay on each order's page.
function SellerCustomersPage() {
    useDocumentTitle("Customers")
    const [sort, setSort] = useState<CustomerSort>("recent")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(`customers|${sort}|${page}`, (signal) => fetchSellerCustomers(sort, page, signal))

    return (
        <div className="money-page customers-page">
            <BackArrow to="/seller/earnings" label="Back to sales" />
            <div className="product-form-title">
                <h1>Customers</h1>
                <p>Everyone who has paid for an order from your shop.</p>
            </div>

            {state.kind === "loading" && <p role="status">Loading your customers...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (() => {
                const { counts, customers, pageSize, total } = state.data
                const repeatShare = counts.customers > 0 ? Math.round(counts.repeatCustomers / counts.customers * 100) : 0

                if (counts.customers === 0) {
                    return (
                        <div className="orders-none">
                            <p><b>No customers yet</b></p>
                            <p>Everyone who pays for an order from your shop shows here.</p>
                        </div>
                    )
                }

                return (
                    <>
                        <dl className="customers-figures">
                            <div className="money-card"><dt>Customers</dt><dd>{counts.customers.toLocaleString("en-NG")}</dd><span>All time</span></div>
                            <div className="money-card"><dt>Came back</dt><dd>{counts.repeatCustomers.toLocaleString("en-NG")}</dd><span>{repeatShare}% ordered more than once</span></div>
                        </dl>

                        <div className="money-chips" role="group" aria-label="Sort by">
                            {SORTS.map((option) => (
                                <button key={option.value} type="button" className={`money-chip${sort === option.value ? " is-on" : ""}`} aria-pressed={sort === option.value} onClick={() => { setSort(option.value); setPage(1) }}>
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="customers-table">
                            <div className="customers-head" aria-hidden="true">
                                <span /><span>Customer</span><span>Orders</span><span>Spent</span><span>First order</span><span>Last order</span>
                            </div>
                            <ul>
                                {customers.map((customer, index) => (
                                    <li key={`${customer.name}-${customer.firstOrderAt}-${index}`} className="customers-row">
                                        <span className={`admin-avatar ${avatarTone((page - 1) * pageSize + index)}`} aria-hidden="true">{customer.name.charAt(0).toUpperCase()}</span>
                                        <span className="customers-name">
                                            <b>{customer.name}</b>
                                            {customer.repeat && <span className="customers-repeat">Came back</span>}
                                        </span>
                                        <span className="customers-orders"><b>{customer.orders}</b> {customer.orders === 1 ? "order" : "orders"}</span>
                                        <span className="customers-spent">
                                            <span className="customers-key">Spent </span><b>{formatNaira(customer.spent)}</b>
                                            {hasAmount(customer.refunded) && <small>{formatNaira(customer.refunded)} refunded</small>}
                                        </span>
                                        <span className="customers-date"><span className="customers-key">First </span>{formatOrderDay(customer.firstOrderAt, { year: true })}</span>
                                        <span className="customers-date"><span className="customers-key">Last </span>{formatOrderDay(customer.lastOrderAt, { year: true })}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="customers-pager">
                            <Pagination page={page} pageSize={pageSize} total={total} onChange={(next) => { setPage(next); window.scrollTo({ top: 0, behavior: "instant" }) }} />
                        </div>
                    </>
                )
            })()}

            <p className="customers-privacy">
                <Lock size={18} aria-hidden="true" />
                Names show as they do on reviews. Phone numbers and addresses stay on each order's page, where you need them to deliver.
            </p>
        </div>
    )
}

export default SellerCustomersPage
