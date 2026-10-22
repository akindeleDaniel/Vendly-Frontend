import { Link, useParams } from "react-router-dom"
import AdminSellerStanding from "../components/AdminSellerStanding"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { fetchAdminUser } from "../lib/adminLookupApi"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

// One person for an administrator: who they are, how they signed up, and how much they have bought,
// sold, complained about or owe, with a way into their orders.
function AdminUserDetailPage() {
    useDocumentTitle("Person")
    const { id = "" } = useParams()
    const { state, reload } = useApiResource(id, (signal) => fetchAdminUser(id, signal))
    const back = <BackArrow to="/admin/users" label="Back to the people search" />

    if (state.kind === "loading") {
        return <p role="status">Loading...</p>
    }

    if (state.kind === "error") {
        return (
            <div>
                {back}
                <h1>Person</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { user } = state.data

    return (
        <div>
            {back}
            <div className="order-header">
                <h1>{user.name}</h1>
                <span className="badge-group">
                    {user.isAdmin && <span className="badge badge-warning">Administrator</span>}
                    <span className="badge">{user.role === "SELLER" ? "Seller" : "Shopper"}</span>
                </span>
            </div>

            <section aria-labelledby="account-heading" className="card summary-card">
                <h2 id="account-heading">Account</h2>
                <dl className="detail-list">
                    <div><dt>Number</dt><dd>{user.id}</dd></div>
                    <div><dt>Email</dt><dd>{user.email}</dd></div>
                    <div><dt>Email confirmed</dt><dd>{user.emailConfirmed ? "Yes" : "No"}</dd></div>
                    <div><dt>Signs in with Google</dt><dd>{user.usesGoogle ? "Yes" : "No"}</dd></div>
                    <div><dt>Joined</dt><dd>{formatShortDate(user.createdAt)}</dd></div>
                    {user.shop && <div><dt>Shop</dt><dd><Link to={`/shop/${encodeURIComponent(user.shop.slug)}`}>{user.shop.businessName}</Link></dd></div>}
                </dl>
            </section>

            <section aria-labelledby="activity-heading" className="card summary-card">
                <h2 id="activity-heading">Activity</h2>
                <dl className="detail-list">
                    <div>
                        <dt>Orders bought</dt>
                        <dd>
                            {user.ordersAsBuyer}
                            {user.ordersAsBuyer > 0 && <> · <Link to={`/admin/orders?buyerId=${user.id}`}>See them</Link></>}
                        </dd>
                    </div>
                    <div>
                        <dt>Orders sold</dt>
                        <dd>
                            {user.ordersAsSeller}
                            {user.ordersAsSeller > 0 && <> · <Link to={`/admin/orders?sellerId=${user.id}`}>See them</Link></>}
                        </dd>
                    </div>
                    <div><dt>Complaints in progress</dt><dd>{user.activeComplaints}</dd></div>
                    <div>
                        <dt>Owed to Vendly</dt>
                        <dd>
                            {formatNaira(user.openLiabilities.amountStillOwed)}
                            {user.openLiabilities.count > 0 && <> across {user.openLiabilities.count} {user.openLiabilities.count === 1 ? "refund" : "refunds"} · <Link to="/admin/liabilities">See debts</Link></>}
                        </dd>
                    </div>
                </dl>
            </section>

            {user.role === "SELLER" && user.shop && <AdminSellerStanding userId={user.id} />}
        </div>
    )
}

export default AdminUserDetailPage
