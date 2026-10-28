import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import { listAdminUsers } from "../lib/adminLookupApi"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

// Finds a person by id, name, email or shop name.
function AdminUsersPage() {
    useDocumentTitle("Find a person")
    const [searchParams] = useSearchParams()
    const initialSearch = searchParams.get("search") ?? ""// from the search box on the Overview
    const [searchInput, setSearchInput] = useState(initialSearch)
    const [search, setSearch] = useState(initialSearch)
    const [role, setRole] = useState("")
    const [adminsOnly, setAdminsOnly] = useState(false)
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(
        `${search}|${role}|${adminsOnly}|${page}`,
        (signal) => listAdminUsers({ search, role, adminsOnly, page }, signal)
    )

    function applySearch(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setSearch(searchInput)
        setPage(1)
    }

    return (
        <div>
            <h1>Find a person</h1>

            <form role="search" onSubmit={applySearch} className="search-form">
                <label className="visually-hidden" htmlFor="admin-user-search">Search people</label>
                <input
                    id="admin-user-search"
                    type="search"
                    maxLength={100}
                    placeholder="Number, name, email or shop name"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />
                <button type="submit">Search</button>
            </form>

            <div className="filter-row">
                <label className="field-inline">
                    Show{" "}
                    <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }}>
                        <option value="">Everyone</option>
                        <option value="CONSUMER">Shoppers</option>
                        <option value="SELLER">Sellers</option>
                    </select>
                </label>
                <label className="checkbox-label">
                    <input type="checkbox" checked={adminsOnly} onChange={(event) => { setAdminsOnly(event.target.checked); setPage(1) }} />
                    Administrators only
                </label>
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
                    <p className="field-help">{state.data.total} {state.data.total === 1 ? "person" : "people"} found.</p>
                    {state.data.users.length === 0 ? <p>Nobody matches.</p> : (
                        <ul className="order-history">
                            {state.data.users.map((user) => (
                                <li key={user.id} className="card order-card">
                                    <div className="order-header">
                                        <h2><Link to={`/admin/users/${user.id}`}>{user.name}</Link></h2>
                                        <span className="badge-group">
                                            {user.isAdmin && <span className="badge badge-warning">Administrator</span>}
                                            <span className="badge">{user.role === "SELLER" ? "Seller" : "Shopper"}</span>
                                        </span>
                                    </div>
                                    <p className="order-line-meta">
                                        {user.email} · Number {user.id} · Joined {formatShortDate(user.createdAt)}
                                    </p>
                                    {user.shop && <p>Shop: {user.shop.businessName}</p>}
                                    <p className="order-line-meta">
                                        {user.emailConfirmed ? "Email confirmed" : "Email not confirmed"}
                                        {user.usesGoogle ? " · Uses Google" : ""}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}
        </div>
    )
}

export default AdminUsersPage
