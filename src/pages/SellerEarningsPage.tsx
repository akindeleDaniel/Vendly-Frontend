import { useState } from "react"
import { Link } from "react-router-dom"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { fetchSellerEarnings } from "../lib/adminLookupApi"
import { formatNaira } from "../lib/money"
import { formatOrderStatus } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

// "2026-10" as "October 2026".
function formatMonth(month: string): string {
    const [year, number] = month.split("-")
    const name = MONTH_NAMES[Number(number) - 1]
    return name ? `${name} ${year}` : month
}

function Figure({ label, value, hint }: { label: string, value: string, hint?: string }) {
    return (
        <div className="figure">
            <dt>{label}</dt>
            <dd>{value}</dd>
            {hint && <p className="figure-hint">{hint}</p>}
        </div>
    )
}

// The seller's sales record: paid orders, what the payment providers took, and what they paid out,
// for a date range, with the last twelve months below. It is built from the figures the providers
// reported for each order, so it is a record of sales and not a bank statement.
function SellerEarningsPage() {
    useDocumentTitle("Earnings")
    const [fromInput, setFromInput] = useState("")
    const [toInput, setToInput] = useState("")
    const [range, setRange] = useState({ from: "", to: "" })
    const [rangeError, setRangeError] = useState("")
    const { state, reload } = useApiResource(`${range.from}|${range.to}`, (signal) => fetchSellerEarnings(range.from, range.to, signal))

    function applyRange(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (fromInput && toInput && fromInput > toInput) {
            setRangeError("The start date must not be after the end date.")
            return
        }

        setRangeError("")
        setRange({ from: fromInput, to: toInput })
    }

    function clearRange() {
        setFromInput("")
        setToInput("")
        setRangeError("")
        setRange({ from: "", to: "" })
    }

    return (
        <div>
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <h1>Earnings</h1>
            <p className="page-intro">
                A record of your paid orders, from the figures the payment providers reported for each one. It is not a bank statement: the money reaches your bank through the provider on its own schedule.
            </p>

            <form onSubmit={applyRange} className="filter-row earnings-range">
                <label className="field-inline">
                    From <input type="date" value={fromInput} max={toInput || undefined} onChange={(event) => setFromInput(event.target.value)} />
                </label>
                <label className="field-inline">
                    To <input type="date" value={toInput} min={fromInput || undefined} onChange={(event) => setToInput(event.target.value)} />
                </label>
                <button type="submit">Show</button>
                {(range.from || range.to) && <button type="button" className="btn-text" onClick={clearRange}>Show everything</button>}
            </form>
            {rangeError && <Notice kind="error">{rangeError}</Notice>}

            {state.kind === "loading" && <p role="status">Loading your earnings...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (() => {
                const { totals, ordersByStatus, owedToVendly, months } = state.data

                return (
                    <>
                        <section aria-labelledby="totals-heading" className="card summary-card">
                            <h2 id="totals-heading">
                                {range.from || range.to ? `${range.from || "The start"} to ${range.to || "today"}` : "All paid orders"}
                            </h2>
                            {totals.ordersWithoutProviderFigures > 0 && (
                                <Notice kind="info">
                                    {totals.ordersWithoutProviderFigures} {totals.ordersWithoutProviderFigures === 1 ? "order has" : "orders have"} no figures from the provider yet, so the fees and payouts below may be incomplete.
                                </Notice>
                            )}
                            <dl className="figures">
                                <Figure label="Paid orders" value={String(totals.orders)} />
                                <Figure label="Sales" value={formatNaira(totals.sales)} hint="What buyers paid you for these orders" />
                                <Figure label="Provider fees" value={formatNaira(totals.providerFees)} hint="Taken by Paystack or Flutterwave" />
                                <Figure label="Paid out by the providers" value={formatNaira(totals.paidOutByProvider)} hint="Sales minus fees" />
                                <Figure label="Refunded to buyers" value={formatNaira(totals.refunded)} />
                                <Figure label="Kept for earlier refunds" value={formatNaira(totals.keptForEarlierRefunds)} hint="Taken from these sales to repay refunds" />
                            </dl>
                        </section>

                        {Object.keys(ordersByStatus).length > 0 && (
                            <section aria-labelledby="status-heading" className="card summary-card">
                                <h2 id="status-heading">Orders by status</h2>
                                <ul className="deduction-list">
                                    {Object.entries(ordersByStatus).map(([status, count]) => (
                                        <li key={status}><span>{formatOrderStatus(status)}</span><strong>{count}</strong></li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {owedToVendly.count > 0 && (
                            <Notice kind="warning">
                                <p>You still owe Vendly {formatNaira(owedToVendly.amountStillOwed)} for {owedToVendly.count} {owedToVendly.count === 1 ? "refund" : "refunds"}.</p>
                                <Link to="/seller/liabilities" className="btn">See what you owe</Link>
                            </Notice>
                        )}

                        <section aria-labelledby="months-heading" className="card summary-card">
                            <h2 id="months-heading">The last twelve months</h2>
                            {months.length === 0 ? (
                                <p>No paid orders in the last twelve months.</p>
                            ) : (
                                <div className="table-scroll">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Month</th>
                                                <th scope="col">Orders</th>
                                                <th scope="col">Sales</th>
                                                <th scope="col">Provider fees</th>
                                                <th scope="col">Paid out</th>
                                                <th scope="col">Refunded</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {months.map((month) => (
                                                <tr key={month.month}>
                                                    <th scope="row">{formatMonth(month.month)}</th>
                                                    <td>{month.orders}</td>
                                                    <td>{formatNaira(month.sales)}</td>
                                                    <td>{formatNaira(month.providerFees)}</td>
                                                    <td>{formatNaira(month.paidOutByProvider)}</td>
                                                    <td>{formatNaira(month.refunded)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                )
            })()}
        </div>
    )
}

export default SellerEarningsPage
