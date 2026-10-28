import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { fetchAdminSummary } from "../lib/adminLookupApi"
import { useApiResource } from "../lib/useApiResource"
import type { AdminSummary } from "../types/admin"

type Item = { to: string, label: string, end?: boolean, count?: (summary: AdminSummary) => number }
type Group = { title: string, items: Item[] }

const GROUPS: Group[] = [
    { title: "Today", items: [{ to: "/admin", label: "Overview", end: true }] },
    { title: "Look up", items: [{ to: "/admin/orders", label: "Orders" }, { to: "/admin/users", label: "People" }] },
    {
        title: "Money and disputes",
        items: [
            { to: "/admin/complaints", label: "Complaints", count: (summary) => summary.complaints.awaitingDecision },
            { to: "/admin/refunds", label: "Refunds", count: (summary) => summary.refunds.needsAttention },
            { to: "/admin/recovery-cases", label: "Recovery cases", count: (summary) => summary.recoveryCases.open },
            { to: "/admin/liabilities", label: "Owed by sellers" }
        ]
    },
    { title: "Shops and content", items: [{ to: "/admin/reviews", label: "Reviews" }] }
]

// Only for super administrators.
const SUPER_GROUP: Group = {
    title: "Super admin",
    items: [{ to: "/admin/platform", label: "Platform" }, { to: "/admin/team", label: "Team" }, { to: "/admin/audit-log", label: "Audit log" }]
}

// The frame around every administrator page: a menu of the admin areas in groups, with a count on the
// ones where something is waiting for a decision. On a phone the menu becomes a row of tabs.
function AdminShell({ children, isSuperAdmin = false }: { children: ReactNode, isSuperAdmin?: boolean }) {
    const groups = isSuperAdmin ? [...GROUPS, SUPER_GROUP] : GROUPS
    const { state } = useApiResource("admin-menu-counts", (signal) => fetchAdminSummary(signal))
    const summary = state.kind === "ready" ? state.data : null

    return (
        <div className="admin-shell">
            <nav className="admin-menu" aria-label="Administration">
                {groups.map((group) => (
                    <div key={group.title} className="admin-menu-group">
                        <p>{group.title}</p>
                        <ul>
                            {group.items.map((item) => {
                                const count = summary && item.count ? item.count(summary) : 0
                                return (
                                    <li key={item.to}>
                                        <NavLink to={item.to} end={item.end} className={({ isActive }) => `admin-menu-link${isActive ? " is-on" : ""}`}>
                                            <span>{item.label}</span>
                                            {count > 0 && <span className="admin-menu-count">{count}<span className="visually-hidden"> waiting</span></span>}
                                        </NavLink>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
            <div className="admin-content">{children}</div>
        </div>
    )
}

export default AdminShell
