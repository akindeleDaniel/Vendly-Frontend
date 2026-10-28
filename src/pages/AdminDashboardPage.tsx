import { useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check, ChevronRight, CircleAlert, FileWarning, RotateCcw, Search } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Notice from "../components/Notice"
import { fetchAdminSummary } from "../lib/adminLookupApi"
import { formatNaira } from "../lib/money"
import { fetchPlatformSummary } from "../lib/platformApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { PlatformSummary } from "../types/platform"

type TaskProps = {
    to: string
    icon: LucideIcon
    tone: "red" | "amber"
    count: number
    label: string
    text: string
    action: string
}

function TaskCard({ to, icon: Icon, tone, count, label, text, action }: TaskProps) {
    return (
        <Link to={to} className={`admin-task${tone === "red" ? " is-hot" : ""}`}>
            <span className="admin-task-top">
                <span className={`admin-task-icon is-${tone}`} aria-hidden="true"><Icon size={20} /></span>
                <b>{count}</b>
            </span>
            <span className="admin-task-label">{label}</span>
            <span className="admin-task-text">{text}</span>
            <span className="admin-task-go">{action}<ChevronRight size={16} aria-hidden="true" /></span>
        </Link>
    )
}

function greetingFor(hour: number): string {
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

// The platform's last 7 days in a line, for super administrators, with a way into the full figures.
function PlatformStrip({ platform }: { platform: PlatformSummary }) {
    return (
        <div className="admin-platform-strip">
            <p>
                <b>Platform figures</b> · {formatNaira(platform.sales.last7Days.net)} in sales in the last 7 days,{" "}
                {platform.orders.last7Days === 1 ? "1 paid order" : `${platform.orders.last7Days} paid orders`},{" "}
                {platform.users.joinedLast7Days === 1 ? "1 person joined" : `${platform.users.joinedLast7Days} people joined`}.
            </p>
            <Link to="/admin/platform" className="btn">See platform figures</Link>
        </div>
    )
}

// What needs an administrator's attention today, with a search into orders and people.
function AdminDashboardPage({ userName, isSuperAdmin }: { userName: string, isSuperAdmin: boolean }) {
    useDocumentTitle("Administration")
    const navigate = useNavigate()
    const searchId = useId()
    const [search, setSearch] = useState("")
    const { state, reload } = useApiResource("summary", (signal) => fetchAdminSummary(signal))
    // Only super administrators can read the platform figures; for others nothing is asked for.
    const platform = useApiResource<PlatformSummary | null>(`platform-${isSuperAdmin}`, (signal) => isSuperAdmin
        ? fetchPlatformSummary(signal)
        : Promise.resolve({ kind: "ok" as const, status: 200, data: null }))
    const platformData = platform.state.kind === "ready" ? platform.state.data : null
    const firstName = userName.trim().split(/\s+/)[0] ?? ""

    function find(where: "orders" | "users") {
        const term = search.trim()
        navigate(term ? `/admin/${where}?search=${encodeURIComponent(term)}` : `/admin/${where}`)
    }

    return (
        <div className="admin-page">
            <div className="admin-head">
                <h1>{greetingFor(new Date().getHours())}{firstName ? `, ${firstName}` : ""}</h1>
                <p>Here's what needs an administrator today.</p>
            </div>

            <form className="admin-find" role="search" onSubmit={(event) => { event.preventDefault(); find("orders") }}>
                <div className="product-input product-money admin-find-box">
                    <Search size={18} aria-hidden="true" />
                    <label htmlFor={searchId} className="visually-hidden">Order number, name or email</label>
                    <input id={searchId} type="search" placeholder="Order number, name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary">Find orders</button>
                <button type="button" className="btn" onClick={() => find("users")}>Find people</button>
            </form>

            {state.kind === "loading" && <p role="status">Loading...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (() => {
                const { complaints, refunds, recoveryCases, liabilities } = state.data
                const waiting = complaints.awaitingDecision + refunds.needsAttention + recoveryCases.open
                const overdue = platformData?.complaints.overdueSellerResponse ?? 0
                const otherRefunds = Math.max(refunds.needsAttention - refunds.failed, 0)

                return (
                    <>
                        <section aria-labelledby="needs-you-heading">
                            <h2 id="needs-you-heading" className="admin-section-title">
                                Needs you {waiting > 0 && <span>{waiting} waiting</span>}
                            </h2>
                            {waiting === 0 ? (
                                <div className="admin-clear" role="status">
                                    <span className="admin-clear-icon" aria-hidden="true"><Check size={22} strokeWidth={2.6} /></span>
                                    <div>
                                        <b>Nothing is waiting for you</b>
                                        <span>No complaints to decide, no refunds to fix and no open recovery cases.</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="admin-tasks">
                                    {complaints.awaitingDecision > 0 && (
                                        <TaskCard
                                            to="/admin/complaints"
                                            icon={CircleAlert}
                                            tone="red"
                                            count={complaints.awaitingDecision}
                                            label={complaints.awaitingDecision === 1 ? "Complaint to decide" : "Complaints to decide"}
                                            text={`The buyer and seller have both had their say.${overdue > 0 ? ` ${overdue === 1 ? "1 seller" : `${overdue} sellers`} didn't answer in time.` : ""}`}
                                            action="Decide complaints"
                                        />
                                    )}
                                    {refunds.needsAttention > 0 && (
                                        <TaskCard
                                            to="/admin/refunds"
                                            icon={RotateCcw}
                                            tone="red"
                                            count={refunds.needsAttention}
                                            label={refunds.needsAttention === 1 ? "Refund that needs you" : "Refunds that need you"}
                                            text={[
                                                refunds.failed > 0 ? `${refunds.failed} failed at the provider` : "",
                                                otherRefunds > 0 ? `${otherRefunds} ${otherRefunds === 1 ? "needs" : "need"} checking` : ""
                                            ].filter(Boolean).join(" and ") + "."}
                                            action="See refunds"
                                        />
                                    )}
                                    {recoveryCases.open > 0 && (
                                        <TaskCard
                                            to="/admin/recovery-cases"
                                            icon={FileWarning}
                                            tone="amber"
                                            count={recoveryCases.open}
                                            label={recoveryCases.open === 1 ? "Open recovery case" : "Open recovery cases"}
                                            text="A payment that needs settling or refunding by hand."
                                            action="Open cases"
                                        />
                                    )}
                                </div>
                            )}
                        </section>

                        <section aria-labelledby="in-progress-heading">
                            <h2 id="in-progress-heading" className="admin-section-title">In progress</h2>
                            <div className="admin-progress">
                                <Link to="/admin/complaints" className="admin-mini">
                                    <small>Complaints with the seller</small>
                                    <b>{complaints.awaitingSeller}</b>
                                    <span>Waiting for the seller's answer</span>
                                </Link>
                                <Link to="/admin/refunds" className="admin-mini">
                                    <small>Refunds on their way</small>
                                    <b>{refunds.pending + refunds.processing}</b>
                                    <span>{refunds.pending} being sent, {refunds.processing} with the provider</span>
                                </Link>
                                <Link to="/admin/liabilities" className="admin-mini">
                                    <small>Owed by sellers</small>
                                    <b>{formatNaira(liabilities.amountStillOwed)}</b>
                                    <span>Across {liabilities.open === 1 ? "1 refund" : `${liabilities.open} refunds`}, paid back from sales</span>
                                </Link>
                            </div>
                        </section>

                        {platformData && <PlatformStrip platform={platformData} />}
                    </>
                )
            })()}
        </div>
    )
}

export default AdminDashboardPage
