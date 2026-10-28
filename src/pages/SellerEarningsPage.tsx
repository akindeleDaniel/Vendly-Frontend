import { useEffect, useId, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Download, RotateCcw } from "lucide-react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import SalesOverview from "../components/SalesOverview"
import { fetchSellerEarnings } from "../lib/adminLookupApi"
import { apiFetch } from "../lib/api"
import { downloadOrdersCsv } from "../lib/insightsApi"
import { formatNaira } from "../lib/money"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { EarningsMonth } from "../types/earnings"

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

type RangeId = "week" | "days30" | "month" | "three" | "year" | "all" | "custom"
type Tab = "overview" | "money"

// "All time" is only on Money: the overview compares one period of at most 366 days with the one before.
const RANGES: Array<{ id: RangeId, label: string, moneyOnly?: boolean }> = [
    { id: "week", label: "Last 7 days" },
    { id: "days30", label: "Last 30 days" },
    { id: "month", label: "This month" },
    { id: "three", label: "Last 3 months" },
    { id: "year", label: "This year" },
    { id: "all", label: "All time", moneyOnly: true },
    { id: "custom", label: "Pick dates" }
]

const MAX_PERIOD_DAYS = 366

const STATUSES: Array<{ value: string, label: string, tone: string }> = [
    { value: "PAID", label: "To ship", tone: "is-amber" },
    { value: "SHIPPED", label: "On the way", tone: "is-green" },
    { value: "DELIVERED", label: "Delivered", tone: "is-forest" },
    { value: "REFUNDED", label: "Refunded", tone: "is-grey" }
]

// "2026-10" as "October 2026", or "Oct" when short.
function formatMonth(month: string, short = false): string {
    const [year, number] = month.split("-")
    const name = MONTH_NAMES[Number(number) - 1]
    return name ? (short ? name.slice(0, 3) : `${name} ${year}`) : month
}

function isoDay(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// The dates sent to the backend for a preset, ending today; "" leaves that end open.
function presetDates(id: RangeId): { from: string, to: string } {
    const today = new Date()
    const daysAgo = (count: number) => isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - count))
    switch (id) {
        case "week":
            return { from: daysAgo(6), to: isoDay(today) }
        case "days30":
            return { from: daysAgo(29), to: isoDay(today) }
        case "month":
            return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDay(today) }
        case "three":
            return { from: isoDay(new Date(today.getFullYear(), today.getMonth() - 2, 1)), to: isoDay(today) }
        case "year":
            return { from: isoDay(new Date(today.getFullYear(), 0, 1)), to: isoDay(today) }
        default:
            return { from: "", to: "" }
    }
}

function rangeName(id: RangeId, from: string, to: string): string {
    switch (id) {
        case "week":
            return "the last 7 days"
        case "days30":
            return "the last 30 days"
        case "month":
            return MONTH_NAMES[new Date().getMonth()]
        case "three":
            return "the last 3 months"
        case "year":
            return String(new Date().getFullYear())
        case "all":
            return "all time"
        default:
            return `${from || "the start"} to ${to || "today"}`
    }
}

// The last twelve months as bars, oldest first, with the months inside the chosen range filled in.
// Picking a bar shows that month's figures; the table below holds the same numbers for screen readers.
function MonthChart({ months, from, to }: { months: EarningsMonth[], from: string, to: string }) {
    const oldestFirst = [...months].reverse()
    const [picked, setPicked] = useState(oldestFirst.length - 1)
    const selected = oldestFirst[Math.min(picked, oldestFirst.length - 1)]
    const highest = Math.max(...oldestFirst.map((month) => Number(month.sales)), 1)
    const fromMonth = from.slice(0, 7)
    const toMonth = to.slice(0, 7)
    const isInRange = (month: string) => (!fromMonth || month >= fromMonth) && (!toMonth || month <= toMonth)

    return (
        <>
            <div className="earnings-chart" role="group" aria-label="Sales by month">
                {oldestFirst.map((month, index) => (
                    <button
                        key={month.month}
                        type="button"
                        className="earnings-bar-button"
                        aria-pressed={index === picked}
                        aria-label={`${formatMonth(month.month)}: ${formatNaira(month.sales)} from ${month.orders} ${month.orders === 1 ? "order" : "orders"}`}
                        onClick={() => setPicked(index)}
                    >
                        <span
                            className={`earnings-bar${isInRange(month.month) ? " is-in-range" : ""}${index === picked ? " is-picked" : ""}`}
                            style={{ height: `${Math.max(3, Math.round((Number(month.sales) / highest) * 100))}%` }}
                        />
                    </button>
                ))}
            </div>
            <div className="earnings-chart-labels" aria-hidden="true">
                {oldestFirst.map((month) => <span key={month.month}>{formatMonth(month.month, true)}</span>)}
            </div>
            {selected && (
                <p className="earnings-picked" aria-live="polite">
                    <b>{formatMonth(selected.month)}</b>
                    <span>{selected.orders === 1 ? "1 order" : `${selected.orders} orders`}</span>
                    <span>Sales {formatNaira(selected.sales)}</span>
                    <span>Paid out {formatNaira(selected.paidOutByProvider)}</span>
                    {Number(selected.refunded) > 0 && <span>Refunded {formatNaira(selected.refunded)}</span>}
                </p>
            )}
            <div className="table-scroll earnings-table">
                <table className="data-table">
                    <caption className="visually-hidden">Sales, fees and payouts by month</caption>
                    <thead>
                        <tr>
                            <th scope="col">Month</th>
                            <th scope="col">Orders</th>
                            <th scope="col">Sales</th>
                            <th scope="col">Fees</th>
                            <th scope="col">Paid out</th>
                            <th scope="col">Refunded</th>
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((month) => (
                            <tr key={month.month} className={month.month === selected?.month ? "is-picked" : undefined}>
                                <th scope="row">{formatMonth(month.month)}</th>
                                <td>{month.orders}</td>
                                <td>{formatNaira(month.sales)}</td>
                                <td>{formatNaira(month.providerFees)}</td>
                                <td>{formatNaira(month.paidOutByProvider)}</td>
                                <td>{Number(month.refunded) > 0 ? formatNaira(month.refunded) : "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    )
}

// Money: what the payment providers took and paid out for the period, with the last twelve months as a
// chart and a table. It is built from the figures the providers reported for each order, so it is a
// record of sales and not a bank statement.
function MoneyTab({ range, name }: { range: { from: string, to: string }, name: string }) {
    const { state, reload } = useApiResource(`${range.from}|${range.to}`, (signal) => fetchSellerEarnings(range.from, range.to, signal))

    return (
        <>
            <p className="product-help sales-tab-lead">Money reaches your bank through Paystack or Flutterwave on their own schedule, so this isn't a bank statement.</p>
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
                        {totals.ordersWithoutProviderFigures > 0 && (
                            <Notice kind="info">
                                {totals.ordersWithoutProviderFigures} {totals.ordersWithoutProviderFigures === 1 ? "order has" : "orders have"} no figures from the provider yet, so the fees and payouts below may be incomplete.
                            </Notice>
                        )}

                        <div className="earnings-hero">
                            <div className="earnings-hero-main">
                                <div>
                                    <small>Paid out by the providers · {name}</small>
                                    <b>{formatNaira(totals.paidOutByProvider)}</b>
                                    <p>From {totals.orders === 1 ? "1 paid order" : `${totals.orders} paid orders`}, after payment fees</p>
                                </div>
                                <dl>
                                    <dt>Sales</dt><dd>{formatNaira(totals.sales)}</dd>
                                    <dt>Payment fees</dt><dd>−{formatNaira(totals.providerFees)}</dd>
                                </dl>
                            </div>
                            <dl className="earnings-figures">
                                <div><dt>Sales</dt><dd>{formatNaira(totals.sales)}</dd><span>What buyers paid for these orders</span></div>
                                <div><dt>Payment fees</dt><dd>{formatNaira(totals.providerFees)}</dd><span>Taken by Paystack or Flutterwave</span></div>
                                <div><dt>Refunded to buyers</dt><dd>{formatNaira(totals.refunded)}</dd><span>For orders in this period</span></div>
                                <div><dt>Kept for earlier refunds</dt><dd>{formatNaira(totals.keptForEarlierRefunds)}</dd><span>Taken from these sales to repay refunds</span></div>
                            </dl>
                        </div>

                        {owedToVendly.count > 0 && (
                            <div className="money-owed" role="status">
                                <span className="money-owed-icon" aria-hidden="true"><RotateCcw size={18} /></span>
                                <p>
                                    <b>You still owe {formatNaira(owedToVendly.amountStillOwed)} for {owedToVendly.count === 1 ? "1 refund" : `${owedToVendly.count} refunds`}.</b>
                                    <span>It comes out of your next sales, never more than half your share of any one order.</span>
                                </p>
                                <Link to="/seller/liabilities" className="btn">See refunds owed</Link>
                            </div>
                        )}

                        <div className="money-grid">
                            <section className="money-card" aria-labelledby="months-heading">
                                <div className="money-card-head">
                                    <h2 id="months-heading">The last twelve months</h2>
                                    {months.length > 0 && <span>Pick a month to see its figures</span>}
                                </div>
                                {months.length === 0
                                    ? <p className="product-help">No paid orders in the last twelve months.</p>
                                    : <MonthChart months={months} from={range.from} to={range.to} />}
                            </section>

                            <div className="money-side">
                                <section className="money-card" aria-labelledby="status-heading">
                                    <h2 id="status-heading" className="money-side-title">Orders in {name}</h2>
                                    <ul className="earnings-statuses">
                                        {STATUSES.map((status) => (
                                            <li key={status.value}>
                                                <Link to={`/seller/orders?status=${status.value}`}>
                                                    <span className={`earnings-dot ${status.tone}`} aria-hidden="true" />
                                                    {status.label}
                                                    <b>{ordersByStatus[status.value] ?? 0}</b>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                                <section className="money-card" aria-labelledby="source-heading">
                                    <h2 id="source-heading" className="money-side-title">Where the numbers come from</h2>
                                    <p className="product-help">Each paid order shows the fee the provider reported. When a provider hasn't reported yet, the order is counted but its fee and payout are left out, and we say so above.</p>
                                </section>
                            </div>
                        </div>
                    </>
                )
            })()}
        </>
    )
}

// The days from one date to another, both included.
function daysBetween(from: string, to: string): number {
    return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1
}

// The seller's sales in two tabs that share the period: Overview (how the shop is doing, compared with
// the period before) and Money (fees, payouts and refunds). The period's paid orders can be downloaded
// as a spreadsheet.
function SellerEarningsPage() {
    useDocumentTitle("Sales")
    const fromId = useId()
    const toId = useId()
    const [searchParams, setSearchParams] = useSearchParams()
    const tab: Tab = searchParams.get("tab") === "money" ? "money" : "overview"
    const [chosenRange, setRangeId] = useState<RangeId>("days30")
    const [fromInput, setFromInput] = useState("")
    const [toInput, setToInput] = useState("")
    const [custom, setCustom] = useState({ from: "", to: "" })
    const [rangeError, setRangeError] = useState("")
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadError, setDownloadError] = useState("")
    const [shopLink, setShopLink] = useState<string | null>(null)
    // All time is only on Money; the overview falls back to the last 30 days.
    const rangeId: RangeId = tab === "overview" && chosenRange === "all" ? "days30" : chosenRange
    const range = rangeId === "custom" ? custom : presetDates(rangeId)
    const name = rangeName(rangeId, range.from, range.to)
    const today = isoDay(new Date())
    const overviewRange = { from: range.from, to: range.to || today }
    const customIncomplete = rangeId === "custom" && (custom.from === "" || custom.to === "")
    const canDownload = rangeId !== "all" && !customIncomplete

    // The shop's link, for the "no orders yet" box on the overview.
    useEffect(() => {
        const controller = new AbortController()
        apiFetch("/seller/profile", { credentials: "include", signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((profile: unknown) => {
                if (!controller.signal.aborted && typeof profile === "object" && profile !== null && "slug" in profile && typeof profile.slug === "string") {
                    setShopLink(`${window.location.origin}/shop/${profile.slug}`)
                }
            })
            .catch(() => null)
        return () => controller.abort()
    }, [])

    function showTab(next: Tab) {
        setSearchParams(next === "money" ? { tab: "money" } : {}, { replace: true })
    }

    function applyCustom(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (fromInput && toInput && fromInput > toInput) {
            setRangeError("The start date must not be after the end date.")
            return
        }

        if (tab === "overview" && (!fromInput || !toInput)) {
            setRangeError("Choose both dates.")
            return
        }

        if (tab === "overview" && daysBetween(fromInput, toInput) > MAX_PERIOD_DAYS) {
            setRangeError(`Choose a period of at most ${MAX_PERIOD_DAYS} days.`)
            return
        }

        setRangeError("")
        setCustom({ from: fromInput, to: toInput })
    }

    async function download() {
        setIsDownloading(true)
        setDownloadError("")
        const failure = await downloadOrdersCsv(overviewRange.from, overviewRange.to)
        setIsDownloading(false)
        setDownloadError(failure ?? "")
    }

    return (
        <div className="money-page">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="sales-head">
                <div className="product-form-title">
                    <h1>Sales</h1>
                    <p>How your shop is doing, and the money from your orders. Only paid orders count, by Nigerian days.</p>
                </div>
                <div className="sales-download">
                    <button type="button" className="btn" disabled={!canDownload || isDownloading} onClick={download}>
                        <Download size={16} aria-hidden="true" />{isDownloading ? "Preparing..." : "Download orders"}
                    </button>
                    <small>{canDownload ? `A spreadsheet of ${name}, for Excel or Google Sheets` : "Choose a period of at most 366 days"}</small>
                </div>
            </div>
            {downloadError && <Notice kind="error">{downloadError}</Notice>}

            <div className="sales-tabs" role="tablist" aria-label="Sales">
                <button type="button" role="tab" aria-selected={tab === "overview"} className={tab === "overview" ? "is-on" : undefined} onClick={() => showTab("overview")}>Overview</button>
                <button type="button" role="tab" aria-selected={tab === "money"} className={tab === "money" ? "is-on" : undefined} onClick={() => showTab("money")}>Money</button>
            </div>

            <div className="money-chips" role="group" aria-label="Time period">
                {RANGES.filter((option) => tab === "money" || !option.moneyOnly).map((option) => (
                    <button key={option.id} type="button" className={`money-chip${rangeId === option.id ? " is-on" : ""}`} aria-pressed={rangeId === option.id} onClick={() => { setRangeId(option.id); setRangeError("") }}>
                        {option.label}
                    </button>
                ))}
            </div>
            {rangeId === "custom" && (
                <form className="earnings-dates" onSubmit={applyCustom}>
                    <div className="product-field">
                        <label htmlFor={fromId}>From</label>
                        <input id={fromId} className="product-input" type="date" value={fromInput} max={toInput || today} onChange={(event) => setFromInput(event.target.value)} />
                    </div>
                    <div className="product-field">
                        <label htmlFor={toId}>To</label>
                        <input id={toId} className="product-input" type="date" value={toInput} min={fromInput || undefined} max={today} onChange={(event) => setToInput(event.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary">Show</button>
                </form>
            )}
            {rangeError && <Notice kind="error">{rangeError}</Notice>}

            {tab === "overview"
                ? (customIncomplete
                    ? <p className="product-help">Choose the dates and press Show.</p>
                    : <SalesOverview from={overviewRange.from} to={overviewRange.to} shopLink={shopLink} />)
                : <MoneyTab range={range} name={name} />}
        </div>
    )
}

export default SellerEarningsPage
