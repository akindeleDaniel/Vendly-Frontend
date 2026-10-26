import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { fetchPlatformSummary } from "../lib/platformApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { SalesFigures } from "../types/platform"

function Figure({ label, value }: { label: string, value: string | number }) {
    return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function SalesRow({ label, figures }: { label: string, figures: SalesFigures }) {
    return (
        <tr>
            <th scope="row">{label}</th>
            <td>{figures.payments}</td>
            <td>{formatNaira(figures.paid)}</td>
            <td>{formatNaira(figures.refunded)}</td>
            <td>{formatNaira(figures.net)}</td>
        </tr>
    )
}

// How the platform is doing, for super administrators: people, shops, orders, money that went through
// StoreHatch, and what needs attention. The figures are counted when the page opens.
function AdminPlatformPage() {
    useDocumentTitle("Platform")
    const { state, reload } = useApiResource("platform", (signal) => fetchPlatformSummary(signal))

    return (
        <div>
            <h1>Platform</h1>

            {state.kind === "loading" && <p role="status">Counting...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (() => {
                const data = state.data

                return (
                    <>
                        <p className="field-help">Counted {formatShortDate(data.generatedAt)}. <button type="button" className="btn-text" onClick={reload}>Count again</button></p>

                        <section aria-labelledby="sales-heading" className="card summary-card">
                            <h2 id="sales-heading">Sales through StoreHatch</h2>
                            <p className="field-help">
                                The value of what shoppers paid through StoreHatch, less refunds. This is not StoreHatch's own income: StoreHatch takes no commission on orders, so each seller's share goes to the seller.
                            </p>
                            <div className="table-scroll">
                                <table className="data-table">
                                    <thead>
                                        <tr><th scope="col">Period</th><th scope="col">Payments</th><th scope="col">Paid</th><th scope="col">Refunded</th><th scope="col">Net</th></tr>
                                    </thead>
                                    <tbody>
                                        <SalesRow label="Today" figures={data.sales.today} />
                                        <SalesRow label="Last 7 days" figures={data.sales.last7Days} />
                                        <SalesRow label="Last 30 days" figures={data.sales.last30Days} />
                                        <SalesRow label="All time" figures={data.sales.allTime} />
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section aria-labelledby="attention-heading" className="card summary-card">
                            <h2 id="attention-heading">Needs attention</h2>
                            <dl className="detail-list">
                                <div><dt>Complaints to decide</dt><dd><Link to="/admin/complaints">{data.complaints.awaitingDecision}</Link></dd></div>
                                <Figure label="Complaints where the seller has not answered in time" value={data.complaints.overdueSellerResponse} />
                                <Figure label="Seller agreed, waiting for approval" value={data.complaints.sellerAgreedAwaitingApproval} />
                                <div><dt>Refunds that need attention</dt><dd><Link to="/admin/refunds">{data.refunds.needsAttention}</Link> (failed: {data.refunds.failed})</dd></div>
                                <div><dt>Reviews that were reported</dt><dd><Link to="/admin/reviews">{data.needsAttention.reportedReviews}</Link></dd></div>
                                <Figure label="Pre-orders waiting for a seller" value={data.needsAttention.preOrdersAwaitingSeller} />
                                <div><dt>Owed by sellers</dt><dd><Link to="/admin/liabilities">{formatNaira(data.sellerDebts.amountStillOwed)}</Link> across {data.sellerDebts.open} {data.sellerDebts.open === 1 ? "debt" : "debts"}</dd></div>
                                <div><dt>Open recovery cases</dt><dd><Link to="/admin/recovery-cases">{data.sellerDebts.recoveryCasesOpen}</Link></dd></div>
                            </dl>
                        </section>

                        <section aria-labelledby="orders-heading" className="card summary-card">
                            <h2 id="orders-heading">Orders</h2>
                            <dl className="detail-list">
                                <Figure label="Paid orders, all time" value={data.orders.paid} />
                                <Figure label="Last 7 days" value={data.orders.last7Days} />
                                <Figure label="Last 30 days" value={data.orders.last30Days} />
                                <Figure label="Waiting to be shipped" value={data.orders.toShip} />
                                <Figure label="Shipped" value={data.orders.shipped} />
                                <Figure label="Delivered" value={data.orders.delivered} />
                                <Figure label="Refunded" value={data.orders.refunded} />
                            </dl>
                        </section>

                        <section aria-labelledby="people-heading" className="card summary-card">
                            <h2 id="people-heading">People and shops</h2>
                            <dl className="detail-list">
                                <Figure label="Accounts" value={data.users.total} />
                                <Figure label="Buyers" value={data.users.buyers} />
                                <Figure label="Sellers" value={data.users.sellers} />
                                <Figure label="Administrators" value={data.users.admins} />
                                <Figure label="Joined in the last 7 days" value={data.users.joinedLast7Days} />
                                <Figure label="Joined in the last 30 days" value={data.users.joinedLast30Days} />
                                <Figure label="Email not confirmed" value={data.users.emailNotConfirmed} />
                                <Figure label="Shops" value={data.shops.total} />
                                <Figure label="Shops with a payout account" value={data.shops.withPayoutAccount} />
                                <Figure label="Shops warned" value={data.shops.warned} />
                                <Figure label="Shops blocked" value={data.shops.blocked} />
                                <Figure label="Products on sale" value={data.shops.listingsOnSale} />
                            </dl>
                        </section>

                        <section aria-labelledby="top-heading" className="card summary-card">
                            <h2 id="top-heading">Top sellers, last 30 days</h2>
                            {data.topSellersLast30Days.length === 0 ? <p>No sales yet.</p> : (
                                <ol>
                                    {data.topSellersLast30Days.map((seller) => (
                                        <li key={seller.sellerId}>
                                            <Link to={`/shop/${encodeURIComponent(seller.slug)}`}>{seller.businessName}</Link>: {formatNaira(seller.sales)} from {seller.orders} {seller.orders === 1 ? "order" : "orders"}
                                            {" "}(<Link to={`/admin/users/${seller.sellerId}`}>person</Link>)
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>
                    </>
                )
            })()}
        </div>
    )
}

export default AdminPlatformPage
