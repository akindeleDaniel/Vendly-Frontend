import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"

const TABS = [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/orders", label: "Orders" },
    { to: "/admin/users", label: "People" },
    { to: "/admin/complaints", label: "Complaints" },
    { to: "/admin/refunds", label: "Refunds" },
    { to: "/admin/recovery-cases", label: "Recovery cases" },
    { to: "/admin/liabilities", label: "Owed by sellers" }
]

// The frame around every administrator page: a title and the tabs between the admin areas.
function AdminShell({ children }: { children: ReactNode }) {
    return (
        <div>
            <p className="admin-kicker">Administration</p>
            <nav aria-label="Administration">
                <ul className="admin-tabs">
                    {TABS.map((tab) => (
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
