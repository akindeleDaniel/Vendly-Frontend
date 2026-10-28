import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Check, ChevronRight, CircleAlert } from "lucide-react"
import { AdminFilters, AdminListHead, AdminPager, AdminSearch } from "../components/AdminList"
import Notice from "../components/Notice"
import { avatarTone, initialsOf, pageOf } from "../lib/adminDisplay"
import { listAdminUsers } from "../lib/adminLookupApi"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminUserRow } from "../types/admin"

type RoleFilter = "" | "CONSUMER" | "SELLER"

const ROLE_FILTERS: Array<{ value: RoleFilter, label: string }> = [
    { value: "", label: "Everyone" },
    { value: "CONSUMER", label: "Shoppers" },
    { value: "SELLER", label: "Sellers" }
]

function PersonRow({ user }: { user: AdminUserRow }) {
    return (
        <li>
            <Link to={`/admin/users/${user.id}`} className="admin-row admin-person-row">
                <span className={`admin-avatar ${avatarTone(user.id)}`} aria-hidden="true">{initialsOf(user.name)}</span>
                <span className="admin-cell">
                    <span className="admin-tags">
                        <b>{user.name}</b>
                        <span className={`admin-tag${user.role === "SELLER" ? " is-seller" : ""}`}>{user.role === "SELLER" ? "Seller" : "Shopper"}</span>
                        {user.isAdmin && <span className="admin-tag is-admin">Administrator</span>}
                    </span>
                    <small className="admin-ellipsis">{user.email} · Number {user.id}</small>
                </span>
                <span className="admin-cell admin-person-shop">
                    {user.shop ? (
                        <>
                            <span className="admin-ellipsis"><span className="admin-key">Shop </span><b className="admin-shop-name">{user.shop.businessName}</b></span>
                            <small className="admin-ellipsis">/shop/{user.shop.slug}</small>
                        </>
                    ) : <small>No shop</small>}
                </span>
                <span className="admin-cell admin-person-account">
                    <span className={`admin-check${user.emailConfirmed ? "" : " is-no"}`}>
                        {user.emailConfirmed ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}
                        {user.emailConfirmed ? "Email confirmed" : "Email not confirmed"}
                    </span>
                    <small>Joined {formatShortDate(user.createdAt)}{user.usesGoogle ? " · Signs in with Google" : ""}</small>
                </span>
                <ChevronRight className="admin-chevron" size={18} aria-hidden="true" />
            </Link>
        </li>
    )
}

// Finds a person by number, name, email or shop name.
function AdminUsersPage() {
    useDocumentTitle("People")
    const [searchParams] = useSearchParams()
    const initialSearch = searchParams.get("search") ?? ""// from the search box on the Overview
    const [search, setSearch] = useState(initialSearch)
    const [role, setRole] = useState<RoleFilter>("")
    const [adminsOnly, setAdminsOnly] = useState(false)
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(
        `${search}|${role}|${adminsOnly}|${page}`,
        (signal) => listAdminUsers({ search, role, adminsOnly, page }, signal)
    )

    return (
        <div className="admin-page">
            <AdminListHead title="People" intro="Shoppers, sellers and administrators, newest first." />

            <div className="admin-tools">
                <AdminSearch
                    label="Search people"
                    placeholder="Number, name, email or shop name"
                    initial={initialSearch}
                    onSearch={(term) => { setSearch(term); setPage(1) }}
                />
                <div className="admin-filter-line">
                    <AdminFilters label="Show" options={ROLE_FILTERS} value={role} onChange={(value) => { setRole(value); setPage(1) }} />
                    <button
                        type="button"
                        className={`orders-filter${adminsOnly ? " is-active" : ""}`}
                        aria-pressed={adminsOnly}
                        onClick={() => { setAdminsOnly(!adminsOnly); setPage(1) }}
                    >
                        Administrators only
                    </button>
                </div>
            </div>

            {state.kind === "loading" && <p role="status">Searching...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    <p className="admin-count">
                        <span><b>{state.data.total.toLocaleString("en-NG")}</b> {state.data.total === 1 ? "person" : "people"}</span>
                        <span>{pageOf(page, state.data.pageSize, state.data.total)}</span>
                    </p>
                    {state.data.users.length === 0 ? <div className="orders-none"><p>Nobody matches.</p></div> : (
                        <div className="admin-panel">
                            <div className="admin-thead admin-person-row" aria-hidden="true">
                                <span /><span>Person</span><span className="admin-person-shop">Shop</span><span className="admin-person-account">Account</span><span />
                            </div>
                            <ul className="admin-rows">
                                {state.data.users.map((user) => <PersonRow key={user.id} user={user} />)}
                            </ul>
                        </div>
                    )}
                    <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}
        </div>
    )
}

export default AdminUsersPage
