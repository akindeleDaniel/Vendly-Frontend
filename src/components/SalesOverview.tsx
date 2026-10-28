import { useState } from "react"
import { Link } from "react-router-dom"
import { Check, ChevronRight, ShoppingBag, Users } from "lucide-react"
import Notice from "./Notice"
import { fetchSellerSummary } from "../lib/insightsApi"
import { formatNaira } from "../lib/money"
import { useApiResource } from "../lib/useApiResource"
import type { SellerSummary } from "../types/insights"

type Metric = "sales" | "orders" | "views"

const METRICS: Array<{ value: Metric, label: string }> = [
    { value: "sales", label: "Sales" },
    { value: "orders", label: "Orders" },
    { value: "views", label: "Visits" }
]

// "2026-10-21" as "Tue 21 Oct", read as a Nigerian calendar day.
function dayName(date: string, withWeekday = true): string {
    const parsed = new Date(`${date}T12:00:00`)
    return Number.isNaN(parsed.getTime())
        ? date
        : parsed.toLocaleDateString("en-NG", { ...(withWeekday ? { weekday: "short" as const } : {}), day: "numeric", month: "short" })
}

function plural(count: number, one: string, many: string): string {
    return `${count.toLocaleString("en-NG")} ${count === 1 ? one : many}`
}

type Change = { text: string, tone: "up" | "down" | "flat" }

// How a figure moved against the period before: a percentage for money and visits, a count otherwise.
function changeOf(now: number, before: number, asPercent: boolean): Change {
    if (now === before) {
        return { text: "Same as before", tone: "flat" }
    }
    const tone = now > before ? "up" : "down"
    const arrow = tone === "up" ? "▲" : "▼"

    if (!asPercent || before === 0) {
        const difference = Math.abs(now - before)
        return { text: `${arrow} ${difference.toLocaleString("en-NG")} ${tone === "up" ? "more" : "fewer"}`, tone }
    }

    return { text: `${arrow} ${Math.round(Math.abs(now - before) / before * 100)}%`, tone }
}

function Figure({ label, value, change, note, isMain = false }: { label: string, value: string, change: Change, note: string, isMain?: boolean }) {
    return (
        <div className={`sales-figure${isMain ? " is-main" : ""}`}>
            <dt>{label}</dt>
            <dd>
                <b>{value}</b>
                <span className={`sales-change is-${change.tone}`}>{change.text}</span>
                <span className="sales-note">{note}</span>
            </dd>
        </div>
    )
}

// The day-by-day bars. Choosing a day shows its sales, orders and visits underneath.
function DayChart({ days }: { days: SellerSummary["days"] }) {
    const [metric, setMetric] = useState<Metric>("sales")
    const [picked, setPicked] = useState(days.length - 1)
    const valueOf = (day: SellerSummary["days"][number]) => metric === "sales" ? Number(day.sales) : metric === "orders" ? day.orders : day.views
    const highest = Math.max(...days.map(valueOf), 1)
    const selected = days[Math.min(picked, days.length - 1)]
    const ticks = days.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((share) => days[Math.round(share * (days.length - 1))]) : days

    return (
        <section className="money-card sales-chart" aria-labelledby="day-chart-heading">
            <div className="money-card-head">
                <h2 id="day-chart-heading">Day by day</h2>
                <div className="sales-switch" role="group" aria-label="Show">
                    {METRICS.map((option) => (
                        <button key={option.value} type="button" className={option.value === metric ? "is-on" : undefined} aria-pressed={option.value === metric} onClick={() => setMetric(option.value)}>
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="sales-bars" role="group" aria-label="Each day of the period. Choose a day to see its figures.">
                {days.map((day, index) => {
                    const value = valueOf(day)
                    return (
                        <button
                            key={day.date}
                            type="button"
                            className="sales-bar-button"
                            aria-pressed={index === picked}
                            aria-label={`${dayName(day.date)}: ${formatNaira(day.sales)}, ${plural(day.orders, "order", "orders")}, ${plural(day.views, "visit", "visits")}`}
                            onClick={() => setPicked(index)}
                        >
                            <span className={`sales-bar${index === picked ? " is-picked" : ""}`} style={{ height: `${value > 0 ? Math.max(3, Math.round(value / highest * 100)) : 0}%` }} />
                        </button>
                    )
                })}
            </div>
            <div className="sales-ticks" aria-hidden="true">{ticks.map((day) => <span key={day.date}>{dayName(day.date, false)}</span>)}</div>
            {selected && (
                <p className="earnings-picked" aria-live="polite">
                    <b>{dayName(selected.date)}</b>
                    <span>{formatNaira(selected.sales)} in sales</span>
                    <span>{plural(selected.orders, "order", "orders")}</span>
                    <span>{plural(selected.views, "visit", "visits")}</span>
                </p>
            )}
        </section>
    )
}

function ProductPicture({ url }: { url: string | null }) {
    return url
        ? <img className="sales-product-photo" src={url} alt="" loading="lazy" />
        : <span className="sales-product-photo" aria-hidden="true"><ShoppingBag size={18} /></span>
}

type SalesOverviewProps = {
    from: string
    to: string
    shopLink: string | null // for the "no orders yet" box
}

// How the shop is doing in a period, compared with the period just before: sales, orders, customers
// and visits, each day as a bar, the best sellers and the most viewed products. What needs the seller
// right now sits on top, whatever the period.
function SalesOverview({ from, to, shopLink }: SalesOverviewProps) {
    const { state, reload } = useApiResource(`summary|${from}|${to}`, (signal) => fetchSellerSummary(from, to, signal))
    const [copied, setCopied] = useState(false)

    if (state.kind === "loading") {
        return <p role="status">Loading your figures...</p>
    }

    if (state.kind === "error") {
        return (
            <Notice kind="error">
                <p>{state.message}</p>
                <button type="button" onClick={reload}>Try again</button>
            </Notice>
        )
    }

    const { totals, previous, days, topProducts, mostViewed, needsAttention } = state.data
    const hasOrders = totals.orders > 0
    const waiting = [
        { count: needsAttention.ordersToShip, to: "/seller/orders?status=PAID", one: "order to ship", many: "orders to ship", tone: "is-hot" },
        { count: needsAttention.complaintsToAnswer, to: "/seller/disputes", one: "complaint to answer", many: "complaints to answer", tone: "is-hot" },
        { count: needsAttention.preOrdersToAnswer, to: "/seller/pre-orders", one: "pre-order to answer", many: "pre-orders to answer", tone: "is-warm" },
        { count: needsAttention.awaitingBuyerConfirmation, to: "/seller/orders?status=SHIPPED", one: "waiting for the buyer to confirm", many: "waiting for the buyer to confirm", tone: "is-calm" }
    ].filter((item) => item.count > 0)
    const conversion = totals.views.total > 0 ? Math.round(totals.orders / totals.views.total * 1000) / 10 : null
    const highestSold = Math.max(...topProducts.map((product) => product.quantity), 1)
    const highestViewed = Math.max(...mostViewed.map((product) => product.views), 1)

    async function copyShopLink() {
        if (!shopLink) {
            return
        }
        try {
            await navigator.clipboard.writeText(shopLink)
            setCopied(true)
        } catch {
            setCopied(false)
        }
    }

    return (
        <>
            <div className="sales-now" role="group" aria-label="Needs you now">
                <b>Right now</b>
                {waiting.length === 0
                    ? <span className="sales-now-clear"><Check size={18} strokeWidth={2.6} aria-hidden="true" />Nothing waiting for you</span>
                    : waiting.map((item) => (
                        <Link key={item.to + item.one} to={item.to} className={item.tone}>
                            <span className="sales-now-count">{item.count}</span>{item.count === 1 ? item.one : item.many}
                        </Link>
                    ))}
            </div>

            <dl className="sales-figures">
                <Figure
                    isMain
                    label="Net sales"
                    value={formatNaira(totals.netSales)}
                    change={changeOf(Number(totals.netSales), Number(previous.netSales), true)}
                    note={Number(totals.refunded) > 0 ? `${formatNaira(totals.sales)} in sales, ${formatNaira(totals.refunded)} refunded` : "Sales less refunds"}
                />
                <Figure label="Orders" value={totals.orders.toLocaleString("en-NG")} change={changeOf(totals.orders, previous.orders, false)} note="Paid orders" />
                <Figure
                    label="Average order"
                    value={totals.averageOrder === null ? "—" : formatNaira(totals.averageOrder)}
                    change={totals.averageOrder === null || previous.averageOrder === null ? { text: "", tone: "flat" } : changeOf(Number(totals.averageOrder), Number(previous.averageOrder), true)}
                    note="Per paid order"
                />
                <Figure label="Customers" value={totals.customers.toLocaleString("en-NG")} change={changeOf(totals.customers, previous.customers, false)} note="Different buyers" />
                <Figure label="Items sold" value={totals.itemsSold.toLocaleString("en-NG")} change={changeOf(totals.itemsSold, previous.itemsSold, false)} note="Across all products" />
                <Figure
                    label="Shop visits"
                    value={totals.views.total.toLocaleString("en-NG")}
                    change={changeOf(totals.views.total, previous.views.total, true)}
                    note={conversion === null ? "No visits yet" : hasOrders ? `${conversion} orders per 100 visits` : `No orders yet from ${plural(totals.views.total, "visit", "visits")}`}
                />
            </dl>

            {hasOrders ? <DayChart days={days} /> : (
                <section className="money-card sales-empty" aria-labelledby="no-orders-heading">
                    <h2 id="no-orders-heading">No orders in this period yet</h2>
                    <p>
                        {totals.views.total > 0 ? `Your shop was visited ${plural(totals.views.total, "time", "times")}. ` : ""}
                        Share your shop link on WhatsApp and Instagram to bring buyers in.
                    </p>
                    {shopLink && <button type="button" className="btn" onClick={copyShopLink}>{copied ? "Link copied" : "Copy your shop link"}</button>}
                </section>
            )}

            <div className="sales-lists">
                <section className="money-card" aria-labelledby="best-sellers-heading">
                    <h2 id="best-sellers-heading">Best sellers</h2>
                    <p className="product-help sales-list-lead">Most sold in this period. Options count towards their product.</p>
                    {topProducts.length === 0 ? <p className="product-help">Your best sellers show here after your first orders.</p> : (
                        <ol className="sales-products">
                            {topProducts.map((product, index) => (
                                <li key={product.listingId}>
                                    <span className="sales-rank">{index + 1}</span>
                                    <ProductPicture url={product.imageUrl} />
                                    <span className="sales-product-name">
                                        <span>
                                            <Link to={`/seller/products/${product.listingId}/edit`}>{product.title}</Link>
                                            {!product.onSale && <span className="sales-tag">Off sale</span>}
                                        </span>
                                        <span className="sales-track" aria-hidden="true"><i style={{ width: `${Math.round(product.quantity / highestSold * 100)}%` }} /></span>
                                    </span>
                                    <span className="sales-product-figure"><b>{product.quantity} sold</b>{formatNaira(product.sales)}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
                <section className="money-card" aria-labelledby="most-viewed-heading">
                    <h2 id="most-viewed-heading">Most viewed</h2>
                    <p className="product-help sales-list-lead">Lots of views but few orders? Check the photos, price and description.</p>
                    {mostViewed.length === 0 ? <p className="product-help">Product visits show here once shoppers start looking.</p> : (
                        <ol className="sales-products">
                            {mostViewed.map((product, index) => (
                                <li key={product.listingId}>
                                    <span className="sales-rank">{index + 1}</span>
                                    <ProductPicture url={product.imageUrl} />
                                    <span className="sales-product-name">
                                        <span>
                                            <Link to={`/seller/products/${product.listingId}/edit`}>{product.title}</Link>
                                            {!product.onSale && <span className="sales-tag">Off sale</span>}
                                        </span>
                                        <span className="sales-track is-amber" aria-hidden="true"><i style={{ width: `${Math.round(product.views / highestViewed * 100)}%` }} /></span>
                                    </span>
                                    <span className="sales-product-figure">
                                        <b>{plural(product.views, "view", "views")}</b>
                                        {product.orders === 0 ? "No orders yet" : `${product.conversionRate ?? 0} orders per 100`}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </div>

            <Link to="/seller/customers" className="money-card sales-customers">
                <span className="sales-customers-icon" aria-hidden="true"><Users size={22} /></span>
                <span>
                    <b>Your customers</b>
                    <span>See who buys from you, who comes back, and who spends the most.</span>
                </span>
                <span className="sales-customers-go">See your customers<ChevronRight size={16} aria-hidden="true" /></span>
            </Link>
        </>
    )
}

export default SalesOverview
