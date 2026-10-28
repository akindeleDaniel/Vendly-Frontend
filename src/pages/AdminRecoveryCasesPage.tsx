import { useState } from "react"
import Notice from "../components/Notice"
import InlineConfirm from "../components/InlineConfirm"
import { listRecoveryCases, refundRecoveryCase, resolveRecoveryCase } from "../lib/adminApi"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatProvider, formatShortDate } from "../lib/orderApi"
import { readRefundFailure } from "../lib/refundErrors"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { RecoveryCase } from "../types/refund"

// A payment that was verified but could not become orders, for example because the stock ran out
// while the shopper was paying. The money has to go back or the case has to be explained.
function RecoveryCaseCard({ item, onChanged }: { item: RecoveryCase, onChanged: (updated: RecoveryCase | null) => void }) {
    const [note, setNote] = useState("")
    const [acknowledgeLowBalance, setAcknowledgeLowBalance] = useState(false)
    const [lowBalance, setLowBalance] = useState(false)
    const [error, setError] = useState("")
    const [isResolving, setIsResolving] = useState(false)

    async function refundAll(): Promise<string | null> {
        const result = await refundRecoveryCase(item.id, { acknowledgeLowBalance })

        if (result.kind === "ok") {
            onChanged(null)// the case closes once the provider accepts, so reload the list
            return null
        }

        const failure = readRefundFailure(result)
        setLowBalance(failure.lowBalance)
        return failure.message
    }

    async function handleResolve(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (note.trim().length < 3) {
            setError("Write a note of at least 3 characters explaining how this was handled.")
            return
        }

        setIsResolving(true)
        setError("")
        const result = await resolveRecoveryCase(item.id, note.trim())
        setIsResolving(false)

        if (result.kind === "ok") {
            onChanged(result.data.case)
        } else {
            setError(failureMessage(result))
        }
    }

    const { payment } = item

    return (
        <li className="card order-card">
            <div className="order-header">
                <h2>{formatNaira(payment.amount)}</h2>
                <span className={item.status === "OPEN" ? "badge badge-warning" : "badge"}>{item.status === "OPEN" ? "Open" : "Resolved"}</span>
            </div>
            <p className="order-line-meta">{formatProvider(payment.provider)} · {formatShortDate(item.createdAt)}</p>
            <dl className="detail-list">
                <div><dt>Why</dt><dd>{item.reason}</dd></div>
                <div><dt>Buyer</dt><dd>{payment.buyer.name}, {payment.buyer.email}</dd></div>
                <div><dt>Payment reference</dt><dd>{payment.reference}</dd></div>
                <div><dt>Checkout</dt><dd>{payment.checkoutId}</dd></div>
                {item.resolutionNote && <div><dt>How it was handled</dt><dd>{item.resolutionNote}</dd></div>}
                {item.resolvedAt && <div><dt>Resolved</dt><dd>{formatShortDate(item.resolvedAt)}</dd></div>}
            </dl>

            {item.status === "OPEN" && (
                <div className="admin-actions">
                    <div>
                        {lowBalance && (
                            <label className="checkbox-label">
                                <input type="checkbox" checked={acknowledgeLowBalance} onChange={(event) => setAcknowledgeLowBalance(event.target.checked)} />
                                Queue the refund anyway
                            </label>
                        )}
                        <InlineConfirm
                            buttonLabel="Refund the whole payment"
                            prompt={`Refund ${formatNaira(payment.amount)} to ${payment.buyer.name}? This cannot be undone.`}
                            confirmLabel="Yes, refund it"
                            onConfirm={refundAll}
                        />
                    </div>
                    <form onSubmit={handleResolve} className="dispute-form">
                        <label>
                            Or close it with a note, if it was handled another way
                            <input type="text" maxLength={300} value={note} disabled={isResolving} onChange={(event) => setNote(event.target.value)} />
                        </label>
                        {error && <Notice kind="error">{error}</Notice>}
                        <button type="submit" disabled={isResolving || note.trim() === ""}>{isResolving ? "Saving..." : "Close the case"}</button>
                    </form>
                </div>
            )}
        </li>
    )
}

function AdminRecoveryCasesPage() {
    useDocumentTitle("Recovery cases")
    const [status, setStatus] = useState("OPEN")
    const { state, setData, reload } = useApiResource(status, (signal) => listRecoveryCases(status, signal))

    function applyChange(id: number, updated: RecoveryCase | null) {
        if (updated === null) {
            reload()
            return
        }

        setData((data) => ({ cases: data.cases.map((item) => item.id === id ? updated : item) }))
    }

    return (
        <div>
            <h1>Recovery cases</h1>
            <p>Payments that were verified but could not become orders. Each one needs a refund or an explanation.</p>
            <label className="field-inline">
                Show{" "}
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="OPEN">Open</option>
                    <option value="RESOLVED">Resolved</option>
                </select>
            </label>

            {state.kind === "loading" && <p role="status">Loading...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                state.data.cases.length === 0
                    ? <p>{status === "OPEN" ? "No open cases." : "No resolved cases."}</p>
                    : (
                        <ul className="order-history">
                            {state.data.cases.map((item) => <RecoveryCaseCard key={item.id} item={item} onChanged={(updated) => applyChange(item.id, updated)} />)}
                        </ul>
                    )
            )}
        </div>
    )
}

export default AdminRecoveryCasesPage
