import { useState } from "react"
import Notice from "../components/Notice"
import InlineConfirm from "../components/InlineConfirm"
import { listAdminLiabilities, recordManualRecovery, writeOffLiability } from "../lib/adminApi"
import { parseOptionalNaira } from "../lib/amountInput"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminLiability, LiabilityStatus } from "../types/refund"

const STATUS_LABELS: Record<LiabilityStatus, string> = {
    OPEN: "Still owed",
    CLEARED: "Paid back",
    WRITTEN_OFF: "Written off",
    VOID: "Cancelled"
}

function LiabilityCard({ liability, onChanged }: { liability: AdminLiability, onChanged: (updated: AdminLiability) => void }) {
    const [amount, setAmount] = useState("")
    const [note, setNote] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")

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
            onChanged(result.data.liability)
        } else {
            setError(failureMessage(result))
        }
    }

    async function writeOff(): Promise<string | null> {
        const reason = note.trim()

        if (reason.length < 3) {
            return "Write a note above explaining why the rest is being written off."
        }

        const result = await writeOffLiability(liability.id, reason)

        if (result.kind === "ok") {
            onChanged(result.data.liability)
            return null
        }

        return failureMessage(result)
    }

    return (
        <li className="card order-card">
            <div className="order-header">
                <h2>{liability.seller.name}</h2>
                <span className={liability.status === "OPEN" ? "badge badge-warning" : "badge"}>{STATUS_LABELS[liability.status]}</span>
            </div>
            <p className="order-line-meta">
                {liability.seller.email}{liability.orderId ? ` · Order ${liability.orderId}` : ""} · {formatShortDate(liability.createdAt)}
            </p>
            {liability.reason && <p>{liability.reason}</p>}
            <div className="summary-row"><span>Refunded</span><span>{formatNaira(liability.amount)}</span></div>
            <div className="summary-row"><span>Recovered</span><span>{formatNaira(liability.recovered)}</span></div>
            <div className="summary-row summary-row-total"><span>Remaining</span><span>{formatNaira(liability.remaining)}</span></div>
            {liability.note && <p className="stepper-shipping-note">{liability.note}</p>}
            {liability.recoveries.length > 0 && (
                <div className="order-extras">
                    <h3 className="order-section-title">Recoveries</h3>
                    <ul className="deduction-list">
                        {liability.recoveries.map((recovery, index) => (
                            <li key={index}>
                                <span>{formatShortDate(recovery.createdAt)} · {recovery.orderId ? `from order ${recovery.orderId}` : recovery.note ?? "by hand"}</span>
                                <strong>{formatNaira(recovery.amount)}</strong>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {liability.status === "OPEN" && (
                <form onSubmit={handleRecovery} className="dispute-form admin-actions">
                    <label>
                        Amount collected by hand, in naira
                        <input inputMode="decimal" value={amount} disabled={isSaving} onChange={(event) => setAmount(event.target.value)} />
                    </label>
                    <label>
                        Note (also used when writing off)
                        <input type="text" maxLength={300} value={note} disabled={isSaving} onChange={(event) => setNote(event.target.value)} />
                    </label>
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="action-row">
                        <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Record money collected"}</button>
                        <InlineConfirm
                            buttonLabel="Write off the rest"
                            prompt={`Give up on the remaining ${formatNaira(liability.remaining)}? This closes the debt.`}
                            confirmLabel="Yes, write it off"
                            danger
                            onConfirm={writeOff}
                        />
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
    const [status, setStatus] = useState("OPEN")
    const { state, setData, reload } = useApiResource(status, (signal) => listAdminLiabilities(status, signal))

    function replaceLiability(updated: AdminLiability) {
        setData((data) => ({ liabilities: data.liabilities.map((item) => item.id === updated.id ? updated : item) }))
    }

    return (
        <div>
            <h1>Owed by sellers</h1>
            <p>Refunds charged to sellers. They are recovered from the sellers' later sales, up to a share of each sale.</p>
            <label className="field-inline">
                Show{" "}
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="OPEN">Still owed</option>
                    <option value="CLEARED">Paid back</option>
                    <option value="WRITTEN_OFF">Written off</option>
                    <option value="VOID">Cancelled</option>
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
                state.data.liabilities.length === 0
                    ? <p>Nothing here.</p>
                    : (
                        <ul className="order-history">
                            {state.data.liabilities.map((item) => <LiabilityCard key={item.id} liability={item} onChanged={replaceLiability} />)}
                        </ul>
                    )
            )}
        </div>
    )
}

export default AdminLiabilitiesPage
