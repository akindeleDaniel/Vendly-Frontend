import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"

type Tab = { to: string, label: string, end?: boolean }

const TABS: Tab[] = [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/users", label: "People" },
    { to: "/admin/complaints", label: "Complaints" },
    { to: "/admin/refunds", label: "Refunds" },
    { to: "/admin/reviews", label: "Reviews" },
    { to: "/admin/recovery-cases", label: "Recovery cases" },
    { to: "/admin/liabilities", label: "Owed by sellers" }
]

// Only for super administrators.
const SUPER_TABS: Tab[] = [
    { to: "/admin/platform", label: "Platform" },
    { to: "/admin/team", label: "Team" },
    { to: "/admin/audit-log", label: "Audit log" }
]

// The frame around every administrator page: a title and the tabs between the admin areas.
function AdminShell({ children, isSuperAdmin = false }: { children: ReactNode, isSuperAdmin?: boolean }) {
    const tabs = isSuperAdmin ? [...TABS, ...SUPER_TABS] : TABS

    return (
        <div>
            <p className="admin-kicker">Administration</p>
            <nav aria-label="Administration">
                <ul className="admin-tabs">
                    {tabs.map((tab) => (
                        <li key={tab.to}>
                            <NavLink to={tab.to} end={tab.end} className={({ isActive }) => isActive ? "admin-tab is-active" : "admin-tab"}>{tab.label}</NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            {children}
        </div>
    )
}

export default AdminShell
