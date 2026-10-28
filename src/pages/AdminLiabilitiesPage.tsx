import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { AdminFilters, AdminListHead } from "../components/AdminList"
import Notice from "../components/Notice"
import { listAdminLiabilities, recordManualRecovery, writeOffLiability } from "../lib/adminApi"
import { fetchAdminSummary } from "../lib/adminLookupApi"
import { parseOptionalNaira } from "../lib/amountInput"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { formatRefundStatus } from "../lib/refundLabels"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminLiability, LiabilityStatus } from "../types/refund"

const STATUS_FILTERS: Array<{ value: LiabilityStatus, label: string }> = [
    { value: "OPEN", label: "Still owed" },
    { value: "CLEARED", label: "Paid back" },
    { value: "WRITTEN_OFF", label: "Written off" },
    { value: "VOID", label: "Cancelled" }
]

const STATUS_TONES: Record<LiabilityStatus, string> = { OPEN: "attention", CLEARED: "done", WRITTEN_OFF: "neutral", VOID: "neutral" }

// How much of a debt has been paid back, from 0 to 100.
function paidBackPercent(liability: AdminLiability): number {
    const amount = Number(liability.amount)
    return amount > 0 ? Math.min(100, Math.max(0, Math.round(Number(liability.recovered) / amount * 100))) : 0
}

function LiabilityCard({ liability, onChanged }: { liability: AdminLiability, onChanged: (updated: AdminLiability) => void }) {
    const id = useId()
    const [mode, setMode] = useState<"idle" | "record" | "write-off">("idle")
    const [amount, setAmount] = useState("")
    const [note, setNote] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")
    const percent = paidBackPercent(liability)
    const isOpen = liability.status === "OPEN"
    const statusLabel = STATUS_FILTERS.find((filter) => filter.value === liability.status)?.label ?? liability.status

    function cancel() {
        setMode("idle")
        setError("")
    }

    async function handleRecovery(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        const parsed = parseOptionalNaira(amount)
        if (!parsed.ok || parsed.value === undefined) {
            setError(parsed.ok ? "Enter the amount you collected, in naira." : parsed.message)
            return
        }

        if (note.trim().length < 3) {
            setError("Write a note of at least 3 characters, for example how the money was collected.")
            return
        }

        setIsSaving(true)
        setError("")
        const result = await recordManualRecovery(liability.id, parsed.value, note.trim())
        setIsSaving(false)

        if (result.kind === "ok") {
            setAmount("")
            setNote("")
            setMode("idle")
            onChanged(result.data.liability)
        } else {
            setError(failureMessage(result))
        }
    }

    async function handleWriteOff(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (note.trim().length < 3) {
            setError("Write a note of at least 3 characters explaining why the rest is being written off.")
            return
        }

        setIsSaving(true)
        setError("")
        const result = await writeOffLiability(liability.id, note.trim())
        setIsSaving(false)

        if (result.kind === "ok") {
            setNote("")
            setMode("idle")
            onChanged(result.data.liability)
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <li className="money-card admin-card">
            <div className="admin-card-top">
                <div className="admin-card-title">
                    <h2>
                        <Link to={`/admin/users/${liability.sellerId}`} className="admin-plain-link">{liability.seller.name}</Link>
                        {!isOpen && <span className={`orders-status is-${STATUS_TONES[liability.status]}`}>{statusLabel}</span>}
                    </h2>
                    <p>
                        {liability.seller.email}
                        {liability.orderId && <> · Refund for <Link to={`/admin/orders/${liability.orderId}`}>order {liability.orderId}</Link></>}
                        {" · "}{formatShortDate(liability.createdAt)}
                    </p>
                </div>
                <div className="admin-owed-left">
                    <small>{isOpen ? "Left to pay back" : "Left unpaid"}</small>
                    <b>{formatNaira(liability.remaining)}</b>
                </div>
            </div>
            {liability.reason && <p className="admin-card-text">{liability.reason}</p>}
            <div className="admin-progress-block">
                <div className="admin-meter-bar" role="img" aria-label={`${percent}% paid back`}><i style={{ width: `${percent}%` }} /></div>
                <div className="admin-progress-label">
                    <span><b>{formatNaira(liability.recovered)}</b> paid back of {formatNaira(liability.amount)}</span>
                    {liability.refundReference && (
                        <span>Refund {liability.refundReference}{liability.refundStatus ? ` · ${formatRefundStatus(liability.refundStatus).toLowerCase()}` : ""}</span>
                    )}
                </div>
            </div>
            {liability.note && <p className="admin-why is-neutral"><b>Note</b>{liability.note}</p>}
            {liability.closedAt && <p className="product-help">Closed {formatShortDate(liability.closedAt)}.</p>}
            {liability.recoveries.length > 0 && (
                <details className="admin-more">
                    <summary>
                        <ChevronRight size={16} aria-hidden="true" />
                        {liability.recoveries.length === 1 ? "1 payment back" : `${liability.recoveries.length} payments back`}
                    </summary>
                    <ul className="admin-recoveries">
                        {liability.recoveries.map((recovery, index) => (
                            <li key={index}>
                                <span>{formatShortDate(recovery.createdAt)} · {recovery.orderId ? `From order ${recovery.orderId}` : recovery.note ?? "Collected by hand"}</span>
                                <b>{formatNaira(recovery.amount)}</b>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {isOpen && mode === "idle" && (
                <div className="admin-actions-row is-split">
                    <button type="button" className="btn" onClick={() => setMode("record")}>Record money collected</button>
                    <span className="admin-spacer" />
                    <button type="button" className="btn-text admin-danger-text" onClick={() => setMode("write-off")}>Write off the rest</button>
                </div>
            )}

            {isOpen && mode === "record" && (
                <form className="admin-confirm" onSubmit={handleRecovery}>
                    <div className="product-two">
                        <div className="product-field">
                            <label htmlFor={`${id}-amount`}>Amount collected, in naira</label>
                            <input id={`${id}-amount`} className="product-input" inputMode="decimal" value={amount} disabled={isSaving} onChange={(event) => setAmount(event.target.value)} />
                        </div>
                        <div className="product-field">
                            <label htmlFor={`${id}-note`}>Note</label>
                            <input id={`${id}-note`} className="product-input" type="text" maxLength={300} placeholder="For example: paid by bank transfer" value={note} disabled={isSaving} onChange={(event) => setNote(event.target.value)} />
                        </div>
                    </div>
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="admin-actions-row">
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Saving..." : "Record it"}</button>
                        <button type="button" className="btn" disabled={isSaving} onClick={cancel}>Cancel</button>
                    </div>
                </form>
            )}

            {isOpen && mode === "write-off" && (
                <form className="admin-confirm" onSubmit={handleWriteOff}>
                    <p>Give up on the remaining <b>{formatNaira(liability.remaining)}</b>? This closes the debt.</p>
                    <div className="product-field">
                        <label htmlFor={`${id}-why`}>Why</label>
                        <input id={`${id}-why`} className="product-input" type="text" maxLength={300} value={note} disabled={isSaving} onChange={(event) => setNote(event.target.value)} />
                    </div>
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="admin-actions-row">
                        <button type="submit" className="btn btn-danger" disabled={isSaving}>{isSaving ? "Please wait..." : "Yes, write it off"}</button>
                        <button type="button" className="btn" disabled={isSaving} onClick={cancel}>Cancel</button>
                    </div>
                </form>
            )}
        </li>
    )
}

// What sellers owe StoreHatch after refunds. Money is recovered from their later sales; what cannot be
// recovered that way is collected by hand or written off here.
function AdminLiabilitiesPage() {
    useDocumentTitle("Owed by sellers")
    const [status, setStatus] = useState<LiabilityStatus>("OPEN")
    const { state, setData, reload } = useApiResource(status, (signal) => listAdminLiabilities(status, signal))
    const summary = useApiResource("admin-menu-counts", (signal) => fetchAdminSummary(signal))
    const owed = summary.state.kind === "ready" ? summary.state.data.liabilities : null

    function replaceLiability(updated: AdminLiability) {
        setData((data) => ({ liabilities: data.liabilities.map((item) => item.id === updated.id ? updated : item) }))
        summary.reload()
    }

    return (
        <div className="admin-page">
            <AdminListHead
                title="Owed by sellers"
                intro="Refunds charged to sellers. Each is paid back from the seller's later sales, a share of each sale at a time."
            />

            {owed && (
                <dl className="admin-figures-row">
                    <div><dt>Still owed</dt><dd>{formatNaira(owed.amountStillOwed)}</dd></div>
                    <div><dt>Refunds being paid back</dt><dd>{owed.open}</dd></div>
                </dl>
            )}

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
                state.data.liabilities.length === 0
                    ? <div className="orders-none"><p>{status === "OPEN" ? "No seller owes anything right now." : "Nothing here."}</p></div>
                    : (
                        <ul className="admin-cards">
                            {state.data.liabilities.map((item) => <LiabilityCard key={item.id} liability={item} onChanged={replaceLiability} />)}
                        </ul>
                    )
            )}
        </div>
    )
}

export default AdminLiabilitiesPage
