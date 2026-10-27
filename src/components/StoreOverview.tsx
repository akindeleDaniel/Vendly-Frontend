import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BarChart3, Check, ChevronRight, CircleAlert, Clock, ExternalLink, Landmark, Package, Pencil, Settings, Star, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import ShopAvatar from "./ShopAvatar"
import { fetchSellerEarnings } from "../lib/adminLookupApi"
import { fetchComplaintsAwaitingSeller } from "../lib/disputeApi"
import { formatNaira } from "../lib/money"
import { fetchPayoutOverview } from "../lib/payoutApi"
import { fetchPreOrdersAwaitingAnswer } from "../lib/preOrderApi"
import type { BrandColor } from "../types/branding"

// What My store knows about the shop itself, from GET /seller/profile.
export type StoreProfile = {
    businessName: string
    slug: string
    logoUrl: string | null
    location: string | null
    ratingAverage: number | null
    ratingCount: number
    takesPreOrders: boolean
    hasDelivery: boolean
    branding: { bannerUrl: string | null, brandColor: BrandColor | null }
}

type StoreOverviewProps = {
    firstName: string
    profile: StoreProfile
    productsOnSale: number
    productsLow: number
}

// The month's figures and what is waiting for the seller. Each is loaded on its own and simply left
// out when it cannot be read, so one slow or failing figure never holds up the page.
type Overview = {
    toShip: number | null
    complaintsToAnswer: number | null
    preOrdersToAnswer: number | null
    hasPayouts: boolean | null
    month: { sales: string, paidOut: string, orders: number } | null
}

function greetingFor(hour: number): string {
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

function currentMonthKey(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function useOverview(): Overview {
    const [overview, setOverview] = useState<Overview>({ toShip: null, complaintsToAnswer: null, preOrdersToAnswer: null, hasPayouts: null, month: null })

    useEffect(() => {
        const controller = new AbortController()
        const { signal } = controller
        const update = (part: Partial<Overview>) => {
            if (!signal.aborted) {
                setOverview((current) => ({ ...current, ...part }))
            }
        }

        fetchSellerEarnings("", "", signal).then((result) => {
            if (result.kind !== "ok") {
                return
            }
            const thisMonth = result.data.months.find((month) => month.month === currentMonthKey())
            update({
                toShip: result.data.ordersByStatus.PAID ?? 0,
                month: thisMonth
                    ? { sales: thisMonth.sales, paidOut: thisMonth.paidOutByProvider, orders: thisMonth.orders }
                    : { sales: "0.00", paidOut: "0.00", orders: 0 }
            })
        })
        fetchComplaintsAwaitingSeller(signal).then((count) => update({ complaintsToAnswer: count }))
        fetchPreOrdersAwaitingAnswer(signal).then((count) => update({ preOrdersToAnswer: count }))
        fetchPayoutOverview(signal).then((result) => {
            if (result.kind === "ok") {
                update({ hasPayouts: result.data.accounts.some((account) => account.status === "ACTIVE") })
            }
        })

        return () => controller.abort()
    }, [])

    return overview
}

function TaskCard({ to, icon: Icon, tone, count, label, text, action }: { to: string, icon: LucideIcon, tone: "amber" | "red" | "green", count: number, label: string, text: string, action: string }) {
    return (
        <Link to={to} className={`store-task${count === 0 ? " is-quiet" : ""}`}>
            <span className="store-task-top">
                <span className={`store-task-icon is-${tone}`} aria-hidden="true"><Icon size={20} /></span>
                <b>{count}</b>
                <span className="store-task-label">{label}</span>
            </span>
            <span className="store-task-text">{text}</span>
            <span className="store-task-go">{action}<ChevronRight size={16} aria-hidden="true" /></span>
        </Link>
    )
}

// The top of My store: the shop as shoppers see it, what needs the seller, the month so far, and
// for a new shop the steps to get it ready.
function StoreOverview({ firstName, profile, productsOnSale, productsLow }: StoreOverviewProps) {
    const overview = useOverview()
    const [copied, setCopied] = useState(false)
    const shopPath = `/shop/${profile.slug}`
    const brandColor = profile.branding.brandColor
    const isNewShop = productsOnSale === 0 && overview.month?.orders === 0

    const steps = [
        { done: true, title: "Shop name and area", text: [profile.businessName, profile.location].filter(Boolean).join(", "), to: "/seller/profile/edit", action: "Store details" },
        { done: profile.hasDelivery, title: "Delivery fees", text: "What you charge to deliver, by state.", to: "/seller/delivery", action: "Set delivery fees" },
        { done: productsOnSale > 0, title: "Add your first product", text: "Photos, a price and how many you have.", to: "#add-product", action: "Add a product" },
        { done: overview.hasPayouts === true, title: "Set up payouts", text: "Your bank account, so payments reach you. Needed before buyers can pay.", to: "/seller/payouts", action: "Set up payouts" },
        { done: Boolean(profile.branding.bannerUrl || profile.logoUrl), title: "Give your shop a look", text: "A banner, a logo and your colour.", to: "/seller/profile/edit", action: "Change the look" }
    ]
    const doneCount = steps.filter((step) => step.done).length
    // Shown until every step is done; payouts count once we know.
    const showSteps = overview.hasPayouts !== null && doneCount < steps.length

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${shopPath}`)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            // Copying can be blocked by the browser; the link is on the page to copy by hand.
        }
    }

    return (
        <>
            <div className="store-greet">
                <div>
                    <h1>{isNewShop ? `Welcome to your shop${firstName ? `, ${firstName}` : ""}` : `${greetingFor(new Date().getHours())}${firstName ? `, ${firstName}` : ""}`}</h1>
                    <p>{isNewShop ? "A few steps and your shop is ready for buyers." : "Here is what needs you today."}</p>
                </div>
            </div>

            <section className="store-shop" aria-labelledby="store-shop-name">
                {profile.branding.bannerUrl ? (
                    <div className="store-banner">
                        <img src={profile.branding.bannerUrl} alt="" />
                        <span className="store-banner-tag">How shoppers see the top of your shop</span>
                        <Link to="/seller/profile/edit" className="btn store-banner-edit"><Pencil size={16} aria-hidden="true" />Change the look</Link>
                    </div>
                ) : (
                    <div className="store-banner is-empty" style={brandColor ? { background: brandColor.background, color: brandColor.text } : undefined}>
                        <b>Add a banner photo</b>
                        <span>It goes across the top of your shop. Until then, shoppers see your shop's colour.</span>
                        <Link to="/seller/profile/edit" className="btn store-banner-add">Add a banner</Link>
                    </div>
                )}
                <div className="store-shop-row">
                    <span className="store-shop-logo">
                        <ShopAvatar name={profile.businessName} logoUrl={profile.logoUrl} brandColor={brandColor ?? undefined} />
                    </span>
                    <div className="store-shop-info">
                        <h2 id="store-shop-name">{profile.businessName}</h2>
                        <p className="store-shop-meta">
                            {profile.location && <span>{profile.location}</span>}
                            {profile.ratingAverage !== null && profile.ratingCount > 0 ? (
                                <span className="store-shop-rating">
                                    <Star size={14} aria-hidden="true" />{profile.ratingAverage.toFixed(1)}
                                    <span> ({profile.ratingCount === 1 ? "1 review" : `${profile.ratingCount} reviews`})</span>
                                </span>
                            ) : <span>No reviews yet</span>}
                        </p>
                    </div>
                    <div className="store-shop-actions">
                        <Link to={shopPath} className="btn"><ExternalLink size={16} aria-hidden="true" />View my shop</Link>
                        <Link to="/seller/profile/edit" className="btn">Store details</Link>
                    </div>
                </div>
                <div className="store-linkbar">
                    <span className="store-linkbar-label">Your shop link</span>
                    <code>{shopPath}</code>
                    <button type="button" className="btn store-copy" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
                    <span className="visually-hidden" aria-live="polite">{copied ? "Shop link copied" : ""}</span>
                    {brandColor && (
                        <span className="store-swatch">
                            <i style={{ background: brandColor.background }} className={brandColor.light ? "is-light" : undefined} aria-hidden="true" />
                            Shop colour: {brandColor.name}
                        </span>
                    )}
                </div>
            </section>

            {showSteps && (
                <section className="store-steps" aria-labelledby="store-steps-title">
                    <div className="store-steps-head">
                        <div className="store-section-title">
                            <h2 id="store-steps-title">Get your shop ready</h2>
                            <span>{doneCount} of {steps.length} done</span>
                        </div>
                        <div className="store-progress" role="img" aria-label={`${doneCount} of ${steps.length} steps done`}>
                            <i style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                        </div>
                    </div>
                    <ol>
                        {steps.map((step) => (
                            <li key={step.title} className={step.done ? "is-done" : undefined}>
                                <span className="store-step-dot" aria-hidden="true">{step.done && <Check size={14} strokeWidth={3.2} />}</span>
                                <div className="store-step-text">
                                    <b>{step.title}<span className="visually-hidden">{step.done ? ", done" : ", to do"}</span></b>
                                    <span>{step.text}</span>
                                </div>
                                {!step.done && (step.to.startsWith("#")
                                    ? <a href={step.to} className="btn">{step.action}</a>
                                    : <Link to={step.to} className="btn">{step.action}</Link>)}
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {!isNewShop && (
                <section aria-labelledby="store-needs-title">
                    <div className="store-section-title"><h2 id="store-needs-title">Needs you</h2></div>
                    <div className="store-tasks">
                        <TaskCard
                            to="/seller/orders"
                            icon={Truck}
                            tone="amber"
                            count={overview.toShip ?? 0}
                            label={overview.toShip === 1 ? "order to ship" : "orders to ship"}
                            text={overview.toShip ? "Paid and waiting for you to send." : "Nothing to send right now."}
                            action="Go to orders"
                        />
                        <TaskCard
                            to="/seller/disputes?group=open"
                            icon={CircleAlert}
                            tone="red"
                            count={overview.complaintsToAnswer ?? 0}
                            label={overview.complaintsToAnswer === 1 ? "complaint to answer" : "complaints to answer"}
                            text={overview.complaintsToAnswer ? "Answer in time, or StoreHatch decides without your side." : "No complaints waiting for you."}
                            action="Go to complaints"
                        />
                        {(profile.takesPreOrders || (overview.preOrdersToAnswer ?? 0) > 0) && (
                            <TaskCard
                                to="/seller/pre-orders?group=waiting"
                                icon={Clock}
                                tone="green"
                                count={overview.preOrdersToAnswer ?? 0}
                                label={overview.preOrdersToAnswer === 1 ? "pre-order to answer" : "pre-orders to answer"}
                                text={overview.preOrdersToAnswer ? "Approve or decline within 48 hours." : "No requests waiting."}
                                action="Go to pre-orders"
                            />
                        )}
                    </div>
                </section>
            )}

            {!isNewShop && overview.month && (
                <section aria-labelledby="store-month-title">
                    <div className="store-section-title">
                        <h2 id="store-month-title">{new Date().toLocaleDateString("en-NG", { month: "long" })} so far</h2>
                        <Link to="/seller/earnings">See earnings</Link>
                    </div>
                    <div className="store-stats">
                        <div className="store-stat"><small>Sales</small><b>{formatNaira(overview.month.sales)}</b><span>{overview.month.orders === 1 ? "From 1 order" : `From ${overview.month.orders} orders`}</span></div>
                        <div className="store-stat"><small>Paid out to you</small><b>{formatNaira(overview.month.paidOut)}</b><span>After payment fees</span></div>
                        <div className="store-stat">
                            <small>Shop rating</small>
                            <b>{profile.ratingAverage !== null && profile.ratingCount > 0 ? `${profile.ratingAverage.toFixed(1)} ★` : "—"}</b>
                            <span>{profile.ratingCount === 1 ? "1 review" : `${profile.ratingCount} reviews`}</span>
                        </div>
                        <div className="store-stat"><small>Products on sale</small><b>{productsOnSale}</b><span>{productsLow === 0 ? "None running low" : `${productsLow} running low`}</span></div>
                    </div>
                </section>
            )}
        </>
    )
}

// The shortcuts at the foot of My store.
export function StoreShortcuts() {
    const shortcuts: Array<{ to: string, icon: LucideIcon, title: string, text: string }> = [
        { to: "/seller/orders", icon: Package, title: "Orders", text: "Ship and track" },
        { to: "/seller/earnings", icon: BarChart3, title: "Earnings", text: "Sales by month" },
        { to: "/seller/reviews", icon: Star, title: "Reviews", text: "What buyers say" },
        { to: "/seller/delivery", icon: Truck, title: "Delivery fees", text: "By state" },
        { to: "/seller/payouts", icon: Landmark, title: "Payouts", text: "Your bank account" },
        { to: "/seller/profile/edit", icon: Settings, title: "Store details", text: "Name, look, links" }
    ]

    return (
        <section aria-labelledby="store-more-title">
            <div className="store-section-title"><h2 id="store-more-title">Run your shop</h2></div>
            <div className="store-shortcuts">
                {shortcuts.map(({ to, icon: Icon, title, text }) => (
                    <Link key={to} to={to} className="store-shortcut">
                        <span className="store-shortcut-icon" aria-hidden="true"><Icon size={18} /></span>
                        <b>{title}</b>
                        <span>{text}</span>
                    </Link>
                ))}
            </div>
        </section>
    )
}

export default StoreOverview
