import { useId, useState } from "react"
import { AdminAllClear, AdminFilters, AdminListHead } from "../components/AdminList"
import Notice from "../components/Notice"
import { listRecoveryCases, refundRecoveryCase, resolveRecoveryCase } from "../lib/adminApi"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatProvider, formatShortDate } from "../lib/orderApi"
import { readRefundFailure } from "../lib/refundErrors"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { RecoveryCase } from "../types/refund"

type StatusFilter = "OPEN" | "RESOLVED"

const STATUS_FILTERS: Array<{ value: StatusFilter, label: string }> = [
    { value: "OPEN", label: "Open" },
    { value: "RESOLVED", label: "Resolved" }
]

// A payment that was verified but could not become orders, for example because the stock ran out
// while the shopper was paying. The money has to go back, or the case is closed with a note.
function RecoveryCaseCard({ item, onChanged }: { item: RecoveryCase, onChanged: (updated: RecoveryCase | null) => void }) {
    const noteId = useId()
    const [mode, setMode] = useState<"idle" | "refund" | "close">("idle")
    const [note, setNote] = useState("")
    const [acknowledgeLowBalance, setAcknowledgeLowBalance] = useState(false)
    const [lowBalance, setLowBalance] = useState(false)
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const { payment } = item
    const isOpen = item.status === "OPEN"

    function cancel() {
        setMode("idle")
        setError("")
        setLowBalance(false)
        setAcknowledgeLowBalance(false)
    }

    async function refundAll() {
        setIsWorking(true)
        setError("")
        const result = await refundRecoveryCase(item.id, { acknowledgeLowBalance })
        setIsWorking(false)

        if (result.kind === "ok") {
            onChanged(null)// the case closes once the provider accepts, so reload the list
            return
        }

        const failure = readRefundFailure(result)
        setLowBalance(failure.lowBalance)
        setError(failure.message)
    }

    async function handleResolve(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (note.trim().length < 3) {
            setError("Write a note of at least 3 characters explaining how this was handled.")
            return
        }

        setIsWorking(true)
        setError("")
        const result = await resolveRecoveryCase(item.id, note.trim())
        setIsWorking(false)

        if (result.kind === "ok") {
            onChanged(result.data.case)
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <li className={`money-card admin-card${isOpen ? " is-hot" : ""}`}>
            <div className="admin-card-title">
                <h2>{formatNaira(payment.amount)} <span className={`orders-status is-${isOpen ? "attention" : "neutral"}`}>{isOpen ? "Open" : "Resolved"}</span></h2>
                <p>{formatProvider(payment.provider)} · Paid {formatShortDate(item.createdAt)} · Case {item.id}</p>
            </div>
            <p className={`admin-why is-${isOpen ? "attention" : "neutral"}`}><b>Why it couldn't become an order</b>{item.reason}</p>
            <dl className="admin-facts">
                <div><dt>Buyer</dt><dd>{payment.buyer.name}<br /><span className="admin-muted">{payment.buyer.email}</span></dd></div>
                <div><dt>Payment reference</dt><dd>{payment.reference}</dd></div>
                <div><dt>Checkout</dt><dd>{payment.checkoutId}</dd></div>
                {item.resolutionNote && <div><dt>How it was handled</dt><dd>{item.resolutionNote}</dd></div>}
                {item.resolvedAt && <div><dt>Resolved</dt><dd>{formatShortDate(item.resolvedAt)}</dd></div>}
            </dl>

            {isOpen && mode === "idle" && (
                <div className="admin-actions-row is-split">
                    <button type="button" className="btn btn-primary" onClick={() => setMode("refund")}>Refund the whole payment</button>
                    <button type="button" className="btn" onClick={() => setMode("close")}>Close with a note</button>
                </div>
            )}

            {isOpen && mode === "refund" && (
                <div className="admin-confirm" role="group" aria-label="Confirm the refund">
                    <p>Refund <b>{formatNaira(payment.amount)}</b> to {payment.buyer.name}? This can't be undone.</p>
                    {lowBalance && (
                        <label className="settings-check">
                            <input type="checkbox" checked={acknowledgeLowBalance} disabled={isWorking} onChange={(event) => setAcknowledgeLowBalance(event.target.checked)} />
                            <span>Queue the refund anyway. It is sent when the provider balance has enough.</span>
                        </label>
                    )}
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="admin-actions-row">
                        <button type="button" className="btn btn-danger" disabled={isWorking || (lowBalance && !acknowledgeLowBalance)} onClick={refundAll}>
                            {isWorking ? "Please wait..." : "Yes, refund it"}
                        </button>
                        <button type="button" className="btn" disabled={isWorking} onClick={cancel}>Cancel</button>
                    </div>
                </div>
            )}

            {isOpen && mode === "close" && (
                <form className="admin-confirm" onSubmit={handleResolve}>
                    <div className="product-field">
                        <label htmlFor={noteId}>How was it handled?</label>
                        <input id={noteId} className="product-input" type="text" maxLength={300} value={note} disabled={isWorking} onChange={(event) => setNote(event.target.value)} />
                        <p className="product-help">For example: refunded by bank transfer. Kept with the case.</p>
                    </div>
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="admin-actions-row">
                        <button type="submit" className="btn btn-primary" disabled={isWorking}>{isWorking ? "Saving..." : "Close the case"}</button>
                        <button type="button" className="btn" disabled={isWorking} onClick={cancel}>Cancel</button>
                    </div>
                </form>
            )}
        </li>
    )
}

function AdminRecoveryCasesPage() {
    useDocumentTitle("Recovery cases")
    const [status, setStatus] = useState<StatusFilter>("OPEN")
    const { state, setData, reload } = useApiResource(status, (signal) => listRecoveryCases(status, signal))

    function applyChange(id: number, updated: RecoveryCase | null) {
        if (updated === null) {
            reload()
            return
        }

        setData((data) => ({ cases: data.cases.map((item) => item.id === id ? updated : item) }))
    }

    return (
        <div className="admin-page">
            <AdminListHead
                title="Recovery cases"
                intro="Payments that came through but couldn't become orders. Refund each one, or close it with a note if it was handled another way."
            />
            <div className="admin-tools">
                <AdminFilters label="Show" options={STATUS_FILTERS} value={status} onChange={setStatus} />
            </div>

            {state.kind === "loading" && <p role="status">Loading...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                state.data.cases.length === 0
                    ? status === "OPEN"
                        ? <AdminAllClear title="No open cases" text="Every payment that came through became an order or was settled." />
                        : <div className="orders-none"><p>No resolved cases.</p></div>
                    : (
                        <ul className="admin-cards">
                            {state.data.cases.map((item) => <RecoveryCaseCard key={item.id} item={item} onChanged={(updated) => applyChange(item.id, updated)} />)}
                        </ul>
                    )
            )}
        </div>
    )
}

export default AdminRecoveryCasesPage
