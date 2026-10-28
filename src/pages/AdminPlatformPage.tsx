import { useState } from "react"
import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import { formatOrderDay } from "../lib/buyerOrders"
import { formatNaira } from "../lib/money"
import { fetchPlatformSummary } from "../lib/platformApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { PlatformSummary } from "../types/platform"

type Period = "today" | "last7Days" | "last30Days" | "allTime"

const PERIODS: Array<{ value: Period, label: string, name: string }> = [
    { value: "today", label: "Today", name: "today" },
    { value: "last7Days", label: "Last 7 days", name: "last 7 days" },
    { value: "last30Days", label: "Last 30 days", name: "last 30 days" },
    { value: "allTime", label: "All time", name: "all time" }
]

const count = (value: number) => value.toLocaleString("en-NG")

type AttentionRow = { label: string, value: string, to?: string, tone: "red" | "amber" | "grey" }

function attentionRows(data: PlatformSummary): AttentionRow[] {
    const { complaints, refunds, needsAttention, sellerDebts } = data

    return [
        { label: "Complaints to decide", value: count(complaints.awaitingDecision), to: "/admin/complaints", tone: "red" },
        { label: "Sellers who didn't answer in time", value: count(complaints.overdueSellerResponse), to: "/admin/complaints", tone: "red" },
        { label: "Seller agreed, waiting for approval", value: count(complaints.sellerAgreedAwaitingApproval), to: "/admin/complaints", tone: "amber" },
        { label: `Refunds that need attention (${refunds.failed} failed)`, value: count(refunds.needsAttention), to: "/admin/refunds", tone: "red" },
        { label: "Reviews that were reported", value: count(needsAttention.reportedReviews), to: "/admin/reviews", tone: "amber" },
        { label: "Pre-orders waiting for a seller", value: count(needsAttention.preOrdersAwaitingSeller), tone: "grey" },
        { label: `Owed by sellers, ${sellerDebts.open === 1 ? "1 refund" : `${sellerDebts.open} refunds`}`, value: formatNaira(sellerDebts.amountStillOwed), to: "/admin/liabilities", tone: "amber" },
        { label: "Open recovery cases", value: count(sellerDebts.recoveryCasesOpen), to: "/admin/recovery-cases", tone: "amber" }
    ]
}

// How the platform is doing, for super administrators: sales through StoreHatch, what needs attention,
// orders, people and shops, and the top sellers. The figures are counted when the page opens.
function AdminPlatformPage() {
    useDocumentTitle("Platform")
    const [period, setPeriod] = useState<Period>("last7Days")
    const { state, reload } = useApiResource("platform", (signal) => fetchPlatformSummary(signal))

    return (
        <div className="admin-page">
            <div className="admin-head admin-head-row">
                <div>
                    <h1>Platform</h1>
                    <p>How StoreHatch is doing. Only super administrators see this page.</p>
                </div>
                {state.kind === "ready" && (
                    <div className="admin-counted">
                        <span>Counted {formatOrderDay(state.data.generatedAt, { time: true })}</span>
                        <button type="button" className="btn" onClick={reload}>Count again</button>
                    </div>
                )}
            </div>

            {state.kind === "loading" && <p role="status">Counting...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (() => {
                const data = state.data
                const sales = data.sales[period]
                const periodName = PERIODS.find((option) => option.value === period)?.name ?? ""
                const { toShip, shipped, delivered, refunded } = data.orders
                const statusTotal = Math.max(toShip + shipped + delivered + refunded, 1)
                const statuses = [
                    { label: "Waiting to be shipped", value: toShip, tone: "is-amber" },
                    { label: "Shipped", value: shipped, tone: "is-green" },
                    { label: "Delivered", value: delivered, tone: "is-forest" },
                    { label: "Refunded", value: refunded, tone: "is-grey" }
                ]
                const payable = data.shops.total > 0 ? Math.round((data.shops.withPayoutAccount / data.shops.total) * 100) : 0
                const topSales = Math.max(...data.topSellersLast30Days.map((seller) => Number(seller.sales)), 1)

                return (
                    <>
                        <section className="money-card" aria-labelledby="sales-heading">
                            <h2 id="sales-heading">Sales through StoreHatch</h2>
                            <p className="product-help admin-card-lead">
                                What shoppers paid, less refunds. This isn't StoreHatch's income: StoreHatch takes no commission, so each seller's share goes to the seller.
                            </p>
                            <div className="money-chips admin-chips" role="group" aria-label="Period">
                                {PERIODS.map((option) => (
                                    <button key={option.value} type="button" className={`money-chip${period === option.value ? " is-on" : ""}`} aria-pressed={period === option.value} onClick={() => setPeriod(option.value)}>
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            <div className="admin-sales">
                                <div className="admin-sales-main">
                                    <small>Net sales · {periodName}</small>
                                    <b>{formatNaira(sales.net)}</b>
                                    <span>From {sales.payments === 1 ? "1 payment" : `${count(sales.payments)} payments`}</span>
                                </div>
                                <dl className="admin-figures">
                                    <div><dt>Paid</dt><dd>{formatNaira(sales.paid)}</dd></div>
                                    <div><dt>Refunded</dt><dd>{formatNaira(sales.refunded)}</dd></div>
                                    <div><dt>Refunds</dt><dd>{count(sales.refunds)}</dd></div>
                                </dl>
                            </div>
                        </section>

                        <section className="money-card" aria-labelledby="attention-heading">
                            <h2 id="attention-heading">Needs attention</h2>
                            <ul className="admin-attention">
                                {attentionRows(data).map((row) => {
                                    const inner = <><span className={`admin-dot is-${row.tone}`} aria-hidden="true" />{row.label}<b>{row.value}</b></>
                                    return <li key={row.label}>{row.to ? <Link to={row.to}>{inner}</Link> : <div>{inner}</div>}</li>
                                })}
                            </ul>
                        </section>

                        <div className="admin-two">
                            <section className="money-card" aria-labelledby="orders-heading">
                                <h2 id="orders-heading">Orders</h2>
                                <dl className="admin-small-figures is-three">
                                    <div><dt>All time</dt><dd>{count(data.orders.paid)}</dd></div>
                                    <div><dt>Last 30 days</dt><dd>{count(data.orders.last30Days)}</dd></div>
                                    <div><dt>Last 7 days</dt><dd>{count(data.orders.last7Days)}</dd></div>
                                </dl>
                                <div className="admin-stack-bar" role="img" aria-label={`Orders by status: ${statuses.map((status) => `${count(status.value)} ${status.label.toLowerCase()}`).join(", ")}`}>
                                    {statuses.map((status) => <i key={status.label} className={status.tone} style={{ width: `${(status.value / statusTotal) * 100}%` }} />)}
                                </div>
                                <ul className="admin-legend">
                                    {statuses.map((status) => (
                                        <li key={status.label}><span className={`admin-swatch ${status.tone}`} aria-hidden="true" />{status.label}<b>{count(status.value)}</b></li>
                                    ))}
                                </ul>
                            </section>

                            <section className="money-card" aria-labelledby="people-heading">
                                <h2 id="people-heading">People and shops</h2>
                                <dl className="admin-small-figures">
                                    <div><dt>Accounts</dt><dd>{count(data.users.total)}</dd></div>
                                    <div><dt>Joined in 7 days</dt><dd>{count(data.users.joinedLast7Days)}</dd></div>
                                    <div><dt>Buyers · sellers</dt><dd>{count(data.users.buyers)} · {count(data.users.sellers)}</dd></div>
                                    <div><dt>Joined in 30 days</dt><dd>{count(data.users.joinedLast30Days)}</dd></div>
                                    <div><dt>Administrators</dt><dd>{count(data.users.admins)}</dd></div>
                                    <div><dt>Email not confirmed</dt><dd>{count(data.users.emailNotConfirmed)}</dd></div>
                                </dl>
                                <div className="admin-meter">
                                    <div className="admin-meter-top">
                                        <span><b>{count(data.shops.withPayoutAccount)}</b> of {count(data.shops.total)} shops can take payments</span>
                                        <span>{payable}%</span>
                                    </div>
                                    <div className="owed-progress" role="img" aria-label={`${payable}% of shops have a payout account`}><i style={{ width: `${payable}%` }} /></div>
                                </div>
                                <dl className="admin-small-figures is-three">
                                    <div><dt>Products on sale</dt><dd>{count(data.shops.listingsOnSale)}</dd></div>
                                    <div><dt>Shops warned</dt><dd>{count(data.shops.warned)}</dd></div>
                                    <div><dt>Shops blocked</dt><dd>{count(data.shops.blocked)}</dd></div>
                                </dl>
                            </section>
                        </div>

                        <section className="money-card" aria-labelledby="top-heading">
                            <h2 id="top-heading">Top sellers, last 30 days</h2>
                            {data.topSellersLast30Days.length === 0 ? <p className="product-help">No sales in the last 30 days.</p> : (
                                <>
                                    <ol className="admin-top">
                                        {data.topSellersLast30Days.map((seller, index) => (
                                            <li key={seller.sellerId}>
                                                <span className="admin-rank" aria-hidden="true">{index + 1}</span>
                                                <div className="admin-top-name">
                                                    <Link to={`/shop/${encodeURIComponent(seller.slug)}`}>{seller.businessName}</Link>
                                                    <span className="admin-top-bar" aria-hidden="true"><i style={{ width: `${Math.round((Number(seller.sales) / topSales) * 100)}%` }} /></span>
                                                </div>
                                                <div className="admin-top-figures">
                                                    <b>{formatNaira(seller.sales)}</b>
                                                    <span>{seller.orders === 1 ? "1 order" : `${count(seller.orders)} orders`} · <Link to={`/admin/users/${seller.sellerId}`}>Person<span className="visually-hidden">: {seller.businessName}'s account</span></Link></span>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                    <p className="product-help">Ranked by what shoppers paid each shop.</p>
                                </>
                            )}
                        </section>
                    </>
                )
            })()}
        </div>
    )
}

export default AdminPlatformPage
