import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import { fetchAdminSummary } from "../lib/adminLookupApi"
import { formatNaira } from "../lib/money"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

function Tile({ to, label, value, needsAttention }: { to: string, label: string, value: string | number, needsAttention?: boolean }) {
    return (
        <Link to={to} className={needsAttention ? "admin-tile needs-attention" : "admin-tile"}>
            <span className="admin-tile-value">{value}</span>
            <span className="admin-tile-label">{label}</span>
        </Link>
    )
}

// What needs an administrator's attention today, with a way into each area and into the lookups.
function AdminDashboardPage() {
    useDocumentTitle("Administration")
    const { state, reload } = useApiResource("summary", (signal) => fetchAdminSummary(signal))

    return (
        <div>
            <h1>Overview</h1>

            {state.kind === "loading" && <p role="status">Loading...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (() => {
                const { complaints, refunds, recoveryCases, liabilities } = state.data

                return (
                    <>
                        <section aria-labelledby="needs-you-heading">
                            <h2 id="needs-you-heading">Needs you</h2>
                            <div className="admin-tiles">
                                <Tile to="/admin/complaints" label="Complaints to decide" value={complaints.awaitingDecision} needsAttention={complaints.awaitingDecision > 0} />
                                <Tile to="/admin/refunds" label="Refunds that need attention" value={refunds.needsAttention} needsAttention={refunds.needsAttention > 0} />
                                <Tile to="/admin/refunds" label="Refunds that failed" value={refunds.failed} needsAttention={refunds.failed > 0} />
                                <Tile to="/admin/recovery-cases" label="Open recovery cases" value={recoveryCases.open} needsAttention={recoveryCases.open > 0} />
                            </div>
                        </section>

                        <section aria-labelledby="in-progress-heading">
                            <h2 id="in-progress-heading">In progress</h2>
                            <div className="admin-tiles">
                                <Tile to="/admin/complaints" label="Complaints waiting for the seller" value={complaints.awaitingSeller} />
                                <Tile to="/admin/refunds" label="Refunds being submitted" value={refunds.pending} />
                                <Tile to="/admin/refunds" label="Refunds processing" value={refunds.processing} />
                                <Tile to="/admin/liabilities" label={`Owed by ${liabilities.open} ${liabilities.open === 1 ? "debt" : "debts"}`} value={formatNaira(liabilities.amountStillOwed)} />
                            </div>
                        </section>

                        <section aria-labelledby="find-heading" className="card summary-card">
                            <h2 id="find-heading">Find something</h2>
                            <div className="action-row">
                                <Link to="/admin/orders" className="btn">Find an order</Link>
                                <Link to="/admin/users" className="btn">Find a person</Link>
                            </div>
                        </section>
                    </>
                )
            })()}
        </div>
    )
}

export default AdminDashboardPage
