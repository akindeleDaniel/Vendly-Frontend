import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUp, Ban, Check, Minus, Plus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { AdminListHead, AdminPager } from "../components/AdminList"
import Notice from "../components/Notice"
import { formatOrderDay } from "../lib/buyerOrders"
import { fetchAuditLog } from "../lib/platformApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { AUDIT_ACTION_LABELS } from "../types/platform"
import type { AdminAction, AuditEntry } from "../types/platform"
import { LAGOS_TIME_ZONE, lagosDay } from "../lib/lagosTime"

const ACTION_ICONS: Record<AdminAction, { icon: LucideIcon, tone: string }> = {
    ADMIN_GRANTED: { icon: Plus, tone: "is-forest" },
    ADMIN_REVOKED: { icon: Minus, tone: "is-stone" },
    SUPER_ADMIN_GRANTED: { icon: ArrowUp, tone: "is-amber" },
    SUPER_ADMIN_REMOVED: { icon: Minus, tone: "is-stone" },
    SELLER_BLOCKED: { icon: Ban, tone: "is-red" },
    SELLER_UNBLOCKED: { icon: Check, tone: "is-sage" }
}

function PersonLink({ person }: { person: { id: number, name: string, email: string | null } }) {
    // A deleted account has no email, and its person page no longer exists.
    return person.email === null ? <span className="admin-muted">{person.name}</span> : <Link to={`/admin/users/${person.id}`}>{person.name}</Link>
}

function dayKey(date: Date): string {
    return lagosDay(date)
}

// "Today", "Yesterday" or the date, for the heading over each day's entries.
function dayLabel(isoTime: string): string {
    const date = new Date(isoTime)
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const todayKey = dayKey(today)
    const yesterdayKey = dayKey(yesterday)

    if (dayKey(date) === todayKey) {
        return "Today"
    }

    return dayKey(date) === yesterdayKey ? "Yesterday" : formatOrderDay(isoTime, { year: true })
}

// The page's entries in days, newest first, as the backend sends them.
function groupByDay(entries: AuditEntry[]): Array<{ label: string, entries: AuditEntry[] }> {
    const days: Array<{ label: string, entries: AuditEntry[] }> = []

    for (const entry of entries) {
        const label = dayLabel(entry.createdAt)
        const last = days[days.length - 1]
        if (last && last.label === label) {
            last.entries.push(entry)
        } else {
            days.push({ label, entries: [entry] })
        }
    }

    return days
}

function EntryRow({ entry }: { entry: AuditEntry }) {
    const { icon: Icon, tone } = ACTION_ICONS[entry.action] ?? { icon: Check, tone: "is-stone" }
    const time = new Date(entry.createdAt).toLocaleTimeString("en-NG", { timeZone: LAGOS_TIME_ZONE, hour: "numeric", minute: "2-digit" })

    return (
        <li className="admin-audit-row">
            <span className={`admin-audit-icon ${tone}`} aria-hidden="true"><Icon size={18} /></span>
            <div className="admin-cell">
                <b>{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</b>
                <span>By <PersonLink person={entry.actor} />{entry.target && <> · About <PersonLink person={entry.target} /></>}</span>
                {entry.detail && <q className="admin-audit-note">{entry.detail}</q>}
            </div>
            <time className="admin-audit-time" dateTime={entry.createdAt}>{time}</time>
        </li>
    )
}

// Who changed who the administrators are, and who blocked or unblocked a shop, newest first. Refunds,
// complaints and reviews record who decided them on the item itself.
function AdminAuditLogPage() {
    useDocumentTitle("Audit log")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(String(page), (signal) => fetchAuditLog(page, signal))

    return (
        <div className="admin-page">
            <AdminListHead title="Audit log" intro="Changes to the team and to shop blocks, newest first. Nothing here can be edited." />

            {state.kind === "loading" && <p role="status">Loading...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.entries.length === 0 ? <div className="orders-none"><p>Nothing has been recorded yet.</p></div> : (
                        groupByDay(state.data.entries).map((day) => (
                            <section key={day.label} aria-label={day.label}>
                                <h2 className="admin-day">{day.label}</h2>
                                <div className="admin-panel">
                                    <ul className="admin-rows">
                                        {day.entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)}
                                    </ul>
                                </div>
                            </section>
                        ))
                    )}
                    <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}
        </div>
    )
}

export default AdminAuditLogPage
