import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import Notice from "../components/Notice"
import { issueAdminRefund, listAdminRefunds, syncAdminRefund } from "../lib/adminApi"
import { parseOptionalNaira } from "../lib/amountInput"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatProvider, formatShortDate } from "../lib/orderApi"
import { formatRefundStatus } from "../lib/refundLabels"
import { readRefundFailure } from "../lib/refundErrors"
import type { RefundFailure } from "../lib/refundErrors"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminRefund } from "../types/refund"

const STATUS_FILTERS = [
    { value: "", label: "All" },
    { value: "PENDING", label: "Being submitted" },
    { value: "PROCESSING", label: "Processing" },
    { value: "NEEDS_ATTENTION", label: "Needs attention" },
    { value: "SUCCEEDED", label: "Refunded" },
    { value: "FAILED", label: "Failed" }
]

// Starts a refund on one order. The amount is the whole refundable amount unless one is typed.
function IssueRefundForm({ onIssued, initialOrderId }: { onIssued: (refund: AdminRefund) => void, initialOrderId: string }) {
    const [orderId, setOrderId] = useState(initialOrderId)
    const [reason, setReason] = useState("")
    const [amount, setAmount] = useState("")
    const [customerNote, setCustomerNote] = useState("")
    const [restock, setRestock] = useState<"" | "true" | "false">("")
    const [chargeSeller, setChargeSeller] = useState(true)
    const [acknowledgeLowBalance, setAcknowledgeLowBalance] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [failure, setFailure] = useState<RefundFailure | null>(null)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSending) {
            return
        }

        const id = Number(orderId)
        if (!Number.isSafeInteger(id) || id <= 0) {
            setError("Enter the order number (the seller order, not the checkout).")
            return
        }

        if (reason.trim().length < 3) {
            setError("Give a reason of at least 3 characters. The seller sees it.")
            return
        }

        const parsedAmount = parseOptionalNaira(amount)
        if (!parsedAmount.ok) {
            setError(parsedAmount.message)
            return
        }

        setIsSending(true)
        setError("")
        setSuccess("")
        setFailure(null)
        const result = await issueAdminRefund(id, {
            reason: reason.trim(),
            amount: parsedAmount.value,
            customerNote: customerNote.trim() || undefined,
            restock: restock === "" ? undefined : restock === "true",
            chargeSeller,
            acknowledgeLowBalance
        })
        setIsSending(false)

        if (result.kind === "ok") {
            setSuccess(`Refund ${result.data.refund.reference} started (${formatRefundStatus(result.data.refund.status).toLowerCase()}).`)
            setOrderId("")
            setReason("")
            setAmount("")
            setCustomerNote("")
            setAcknowledgeLowBalance(false)
            onIssued(result.data.refund)
        } else {
            const read = readRefundFailure(result)
            setFailure(read)
            setError(read.message)
        }
    }

    return (
        <details className="card summary-card admin-issue" open={initialOrderId !== "" ? true : undefined}>
            <summary>Issue a refund</summary>
            <form onSubmit={handleSubmit} className="dispute-form">
                <label>
                    Order number
                    <input inputMode="numeric" value={orderId} disabled={isSending} onChange={(event) => setOrderId(event.target.value.replace(/\D/g, ""))} />
                </label>
                <p className="field-help"><Link to="/admin/orders">Find the order number</Link> by searching for the buyer, the seller or a payment reference.</p>
                <label>
                    Reason (the seller sees this)
                    <input type="text" maxLength={300} value={reason} disabled={isSending} onChange={(event) => setReason(event.target.value)} />
                </label>
                <label>
                    Amount in naira (leave empty to refund everything still refundable)
                    <input inputMode="decimal" value={amount} disabled={isSending} onChange={(event) => setAmount(event.target.value)} />
                </label>
                <label>
                    Note to the buyer (optional)
                    <input type="text" maxLength={300} value={customerNote} disabled={isSending} onChange={(event) => setCustomerNote(event.target.value)} />
                </label>
                <label>
                    Put the items back in stock
                    <select value={restock} disabled={isSending} onChange={(event) => setRestock(event.target.value as "" | "true" | "false")}>
                        <option value="">Let the system decide</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label className="checkbox-label">
                    <input type="checkbox" checked={chargeSeller} disabled={isSending} onChange={(event) => setChargeSeller(event.target.checked)} />
                    Charge the refund to the seller
                </label>
                {failure?.lowBalance && (
                    <label className="checkbox-label">
                        <input type="checkbox" checked={acknowledgeLowBalance} disabled={isSending} onChange={(event) => setAcknowledgeLowBalance(event.target.checked)} />
                        Queue the refund anyway
                    </label>
                )}
                {success && <Notice kind="success">{success}</Notice>}
                {error && (
                    <Notice kind="error">
                        <p>{error}</p>
                        {failure?.unknownReference && <p>Reference: {failure.unknownReference}</p>}
                    </Notice>
                )}
                <button type="submit" disabled={isSending || (failure?.lowBalance === true && !acknowledgeLowBalance)}>
                    {isSending ? "Sending..." : "Issue the refund"}
                </button>
            </form>
        </details>
    )
}

function RefundCard({ refund, onChanged }: { refund: AdminRefund, onChanged: (refund: AdminRefund) => void }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [error, setError] = useState("")
    const canSync = refund.status === "PENDING" || refund.status === "PROCESSING" || refund.status === "NEEDS_ATTENTION"

    async function handleSync() {
        setIsSyncing(true)
        setError("")
        const result = await syncAdminRefund(refund.id)
        setIsSyncing(false)

        if (result.kind === "ok") {
            onChanged(result.data.refund)
        } else {
            setError(failureMessage(result))
        }
    }

    return (
        <li className="card order-card">
            <div className="order-header">
                <h2>{formatNaira(refund.amount)}</h2>
                <span className={refund.status === "FAILED" || refund.status === "NEEDS_ATTENTION" ? "badge badge-warning" : "badge"}>
                    {formatRefundStatus(refund.status)}
                </span>
            </div>
            <p className="order-line-meta">
                {refund.orderId ? `Order ${refund.orderId}` : "Whole payment"} · {formatProvider(refund.provider)} · {formatShortDate(refund.createdAt)}
            </p>
            <dl className="detail-list">
                <div><dt>Reference</dt><dd>{refund.reference}</dd></div>
                <div><dt>Payment</dt><dd>{refund.paymentReference}</dd></div>
                <div><dt>Reason</dt><dd>{refund.reason}</dd></div>
                {refund.customerNote && <div><dt>Note to the buyer</dt><dd>{refund.customerNote}</dd></div>}
                {refund.providerStatus && <div><dt>Provider says</dt><dd>{refund.providerStatus}</dd></div>}
                {refund.awaitingFunds && <div><dt>Waiting for</dt><dd>Funds in Vendly's provider balance</dd></div>}
                {refund.expectedAt && <div><dt>Expected</dt><dd>{formatShortDate(refund.expectedAt)}</dd></div>}
                {refund.completedAt && <div><dt>Completed</dt><dd>{formatShortDate(refund.completedAt)}</dd></div>}
                {refund.failureReason && <div><dt>Why it failed</dt><dd>{refund.failureReason}</dd></div>}
                <div><dt>Items back in stock</dt><dd>{refund.restockedAt ? `Yes, ${formatShortDate(refund.restockedAt)}` : refund.restock ? "Planned" : "No"}</dd></div>
                <div>
                    <dt>Charged to the seller</dt>
                    <dd>
                        {refund.liability
                            ? `${formatNaira(refund.liability.amount)}, ${formatNaira(refund.liability.recovered)} recovered`
                            : refund.chargeSeller ? "Not yet (waits for the provider)" : "No"}
                    </dd>
                </div>
            </dl>
            {error && <Notice kind="error">{error}</Notice>}
            {canSync && (
                <button type="button" disabled={isSyncing} onClick={handleSync}>
                    {isSyncing ? "Checking..." : "Check with the provider"}
                </button>
            )}
        </li>
    )
}

// Every refund, newest first, with a way to ask the provider where one stands and to issue another.
function AdminRefundsPage() {
    useDocumentTitle("Refunds")
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState("")
    const { state, setData, reload } = useApiResource(`${page}:${status}`, (signal) => listAdminRefunds(page, status, signal))
    const [searchParams] = useSearchParams()
    const orderFromSearch = (searchParams.get("order") ?? "").replace(/\D/g, "")// an order chosen in the order search

    function replaceRefund(updated: AdminRefund) {
        setData((data) => ({ ...data, refunds: data.refunds.map((refund) => refund.id === updated.id ? updated : refund) }))
    }

    return (
        <div>
            <h1>Refunds</h1>
            <IssueRefundForm key={orderFromSearch} onIssued={reload} initialOrderId={orderFromSearch} />

            <label className="field-inline">
                Show{" "}
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
                    {STATUS_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
            </label>

            {state.kind === "loading" && <p role="status">Loading refunds...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.refunds.length === 0 ? <p>No refunds here.</p> : (
                        <ul className="order-history">
                            {state.data.refunds.map((refund) => <RefundCard key={refund.id} refund={refund} onChanged={replaceRefund} />)}
                        </ul>
                    )}
                    {state.data.total > state.data.pageSize && (
                        <div className="action-row">
                            <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</button>
                            <span>Page {page} of {Math.ceil(state.data.total / state.data.pageSize)}</span>
                            <button type="button" onClick={() => setPage(page + 1)} disabled={page * state.data.pageSize >= state.data.total}>Next</button>
                        </div>
                    )}
                </>
            )}
            <p className="field-help"><Link to="/admin/complaints">Back to complaints</Link></p>
        </div>
    )
}

export default AdminRefundsPage
