import { useState } from "react"
import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import Pagination from "../components/Pagination"
import { formatShortDate } from "../lib/orderApi"
import { fetchAuditLog } from "../lib/platformApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { AUDIT_ACTION_LABELS } from "../types/platform"
import BackArrow from "../components/BackArrow"

function PersonLink({ person }: { person: { id: number, name: string, email: string | null } }) {
    // A deleted account has no email, and its person page no longer exists.
    return person.email === null ? <>{person.name}</> : <><Link to={`/admin/users/${person.id}`}>{person.name}</Link> ({person.email})</>
}

// Who changed who the administrators are, and who blocked or unblocked a shop, newest first. Refunds,
// complaints and reviews record who decided them on the item itself.
function AdminAuditLogPage() {
    useDocumentTitle("Audit log")
    const [page, setPage] = useState(1)
    const { state, reload } = useApiResource(String(page), (signal) => fetchAuditLog(page, signal))

    return (
        <div>
            <BackArrow to="/admin" label="Back to the admin dashboard" />
            <h1>Audit log</h1>

            {state.kind === "loading" && <p role="status">Loading...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.entries.length === 0 ? <p>Nothing has been recorded yet.</p> : (
                        <ul className="order-history">
                            {state.data.entries.map((entry) => (
                                <li key={entry.id} className="card order-card">
                                    <div className="order-header">
                                        <h2>{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</h2>
                                        <span className="order-line-meta">{formatShortDate(entry.createdAt)}</span>
                                    </div>
                                    <dl className="detail-list">
                                        <div><dt>By</dt><dd><PersonLink person={entry.actor} /></dd></div>
                                        {entry.target && <div><dt>About</dt><dd><PersonLink person={entry.target} /></dd></div>}
                                        {entry.detail && <div><dt>Note</dt><dd>{entry.detail}</dd></div>}
                                    </dl>
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

export default AdminAuditLogPage
