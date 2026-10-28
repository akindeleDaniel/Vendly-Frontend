import { useId, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ChevronRight, Plus, RotateCcw } from "lucide-react"
import { AdminFilters, AdminListHead, AdminPager } from "../components/AdminList"
import Notice from "../components/Notice"
import { issueAdminRefund, listAdminRefunds, syncAdminRefund } from "../lib/adminApi"
import { pageOf } from "../lib/adminDisplay"
import { parseOptionalNaira } from "../lib/amountInput"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatProvider, formatShortDate } from "../lib/orderApi"
import { formatRefundStatus } from "../lib/refundLabels"
import { readRefundFailure } from "../lib/refundErrors"
import type { RefundFailure } from "../lib/refundErrors"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { AdminRefund, RefundStatus } from "../types/refund"

type StatusFilter = "" | RefundStatus

const STATUS_FILTERS: Array<{ value: StatusFilter, label: string }> = [
    { value: "", label: "All" },
    { value: "NEEDS_ATTENTION", label: "Needs attention" },
    { value: "FAILED", label: "Failed" },
    { value: "PENDING", label: "Being submitted" },
    { value: "PROCESSING", label: "Processing" },
    { value: "SUCCEEDED", label: "Refunded" }
]

const STATUS_TONES: Record<RefundStatus, string> = {
    PENDING: "progress",
    PROCESSING: "progress",
    NEEDS_ATTENTION: "attention",
    SUCCEEDED: "done",
    FAILED: "bad"
}

type IssueFormProps = {
    initialOrderId: string
    onIssued: () => void
    onClose: () => void
}

// Starts a refund on one order. The amount is the whole refundable amount unless one is typed.
function IssueRefundForm({ initialOrderId, onIssued, onClose }: IssueFormProps) {
    const id = useId()
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

        const order = Number(orderId)
        if (!Number.isSafeInteger(order) || order <= 0) {
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
        const result = await issueAdminRefund(order, {
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
            onIssued()
        } else {
            const read = readRefundFailure(result)
            setFailure(read)
            setError(read.message)
        }
    }

    return (
        <section className="money-card" aria-labelledby={`${id}-title`}>
            <div className="admin-card-top">
                <div className="admin-card-title">
                    <h2 id={`${id}-title`}>Issue a refund</h2>
                    <p>The money goes back to the buyer's card or account through the payment provider.</p>
                </div>
                <button type="button" className="btn-text" onClick={onClose}>Close</button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form" noValidate>
                <div className="product-two">
                    <div className="product-field">
                        <label htmlFor={`${id}-order`}>Order number</label>
                        <input id={`${id}-order`} className="product-input" inputMode="numeric" value={orderId} disabled={isSending} onChange={(event) => setOrderId(event.target.value.replace(/\D/g, ""))} />
                        <p className="product-help"><Link to="/admin/orders">Find the order number</Link> by searching for the buyer, the seller or a payment reference.</p>
                    </div>
                    <div className="product-field">
                        <label htmlFor={`${id}-amount`}>Amount, in naira</label>
                        <input id={`${id}-amount`} className="product-input" inputMode="decimal" value={amount} disabled={isSending} onChange={(event) => setAmount(event.target.value)} />
                        <p className="product-help">Leave it empty to refund everything still refundable.</p>
                    </div>
                </div>
                <div className="product-field">
                    <label htmlFor={`${id}-reason`}>Reason</label>
                    <input id={`${id}-reason`} className="product-input" type="text" maxLength={300} value={reason} disabled={isSending} onChange={(event) => setReason(event.target.value)} />
                    <p className="product-help">The seller sees this.</p>
                </div>
                <div className="product-field">
                    <label htmlFor={`${id}-note`}>Note to the buyer (optional)</label>
                    <textarea id={`${id}-note`} className="product-input" maxLength={300} rows={2} value={customerNote} disabled={isSending} onChange={(event) => setCustomerNote(event.target.value)} />
                </div>
                <div className="product-two">
                    <div className="product-field">
                        <label htmlFor={`${id}-restock`}>Put the items back in stock</label>
                        <select id={`${id}-restock`} className="product-input" value={restock} disabled={isSending} onChange={(event) => setRestock(event.target.value as "" | "true" | "false")}>
                            <option value="">Let the system decide</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </select>
                    </div>
                    <label className="settings-check">
                        <input type="checkbox" checked={chargeSeller} disabled={isSending} onChange={(event) => setChargeSeller(event.target.checked)} />
                        <span><b>Charge the refund to the seller</b> Paid back from their later sales.</span>
                    </label>
                </div>
                {failure?.lowBalance && (
                    <label className="settings-check">
                        <input type="checkbox" checked={acknowledgeLowBalance} disabled={isSending} onChange={(event) => setAcknowledgeLowBalance(event.target.checked)} />
                        <span>Queue the refund anyway. It is sent when the provider balance has enough.</span>
                    </label>
                )}
                {success && <Notice kind="success">{success}</Notice>}
                {error && (
                    <Notice kind="error">
                        <p>{error}</p>
                        {failure?.unknownReference && <p>Reference: {failure.unknownReference}</p>}
                    </Notice>
                )}
                <div className="admin-actions-row">
                    <button type="submit" className="btn btn-primary" disabled={isSending || (failure?.lowBalance === true && !acknowledgeLowBalance)}>
                        {isSending ? "Sending..." : "Issue the refund"}
                    </button>
                    <button type="button" className="btn" disabled={isSending} onClick={onClose}>Cancel</button>
                </div>
            </form>
        </section>
    )
}

// What went wrong with a refund, in a coloured box, when something needs an administrator.
function refundProblem(refund: AdminRefund): { title: string, text: string, tone: "bad" | "attention" } | null {
    if (refund.status === "FAILED") {
        return { title: "Why it failed", text: refund.failureReason ?? "The provider turned it down. Try again or refund the buyer another way.", tone: "bad" }
    }

    if (refund.status === "NEEDS_ATTENTION" || refund.awaitingFunds) {
        return refund.awaitingFunds
            ? { title: "Waiting for money", text: `${formatProvider(refund.provider)} is waiting for funds in StoreHatch's balance before it can send this.`, tone: "attention" }
            : { title: "Needs checking", text: refund.providerStatus ? `The provider says: ${refund.providerStatus}.` : "Check with the provider to see where it stands.", tone: "attention" }
    }

    return null
}

function RefundCard({ refund, onChanged }: { refund: AdminRefund, onChanged: (refund: AdminRefund) => void }) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [error, setError] = useState("")
    const canSync = refund.status === "PENDING" || refund.status === "PROCESSING" || refund.status === "NEEDS_ATTENTION"
    const problem = refundProblem(refund)

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
        <li className={`money-card admin-card${refund.status === "FAILED" ? " is-hot" : ""}`}>
            <div className="admin-card-title">
                <h2>{formatNaira(refund.amount)} <span className={`orders-status is-${STATUS_TONES[refund.status]}`}>{formatRefundStatus(refund.status)}</span></h2>
                <p>
                    {refund.orderId ? <Link to={`/admin/orders/${refund.orderId}`}>Order {refund.orderId}</Link> : "Whole payment"}
                    {" · "}{formatProvider(refund.provider)} · {formatShortDate(refund.createdAt)}
                </p>
            </div>
            <p className="admin-card-text">{refund.reason}</p>
            {problem && <p className={`admin-why is-${problem.tone}`}><b>{problem.title}</b>{problem.text}</p>}
            <details className="admin-more">
                <summary><ChevronRight size={16} aria-hidden="true" />Details</summary>
                <dl className="admin-facts">
                    <div><dt>Refund reference</dt><dd>{refund.reference}</dd></div>
                    <div><dt>Payment reference</dt><dd>{refund.paymentReference}</dd></div>
                    {refund.providerRefundId && <div><dt>Provider's refund number</dt><dd>{refund.providerRefundId}</dd></div>}
                    {refund.providerStatus && <div><dt>Provider says</dt><dd>{refund.providerStatus}</dd></div>}
                    {refund.customerNote && <div><dt>Note to the buyer</dt><dd>{refund.customerNote}</dd></div>}
                    <div><dt>Items back in stock</dt><dd>{refund.restockedAt ? `Yes, ${formatShortDate(refund.restockedAt)}` : refund.restock ? "Planned" : "No"}</dd></div>
                    <div>
                        <dt>Charged to the seller</dt>
                        <dd>
                            {refund.liability
                                ? `${formatNaira(refund.liability.amount)}, ${formatNaira(refund.liability.recovered)} paid back`
                                : refund.chargeSeller ? "Not yet (waits for the provider)" : "No"}
                        </dd>
                    </div>
                    {refund.expectedAt && !refund.completedAt && <div><dt>Expected</dt><dd>{formatShortDate(refund.expectedAt)}</dd></div>}
                    {refund.completedAt && <div><dt>{refund.status === "FAILED" ? "Failed on" : "Completed"}</dt><dd>{formatShortDate(refund.completedAt)}</dd></div>}
                </dl>
            </details>
            {error && <Notice kind="error">{error}</Notice>}
            {canSync && (
                <div className="admin-actions-row is-split">
                    <button type="button" className="btn" disabled={isSyncing} onClick={handleSync}>
                        <RotateCcw size={16} aria-hidden="true" />{isSyncing ? "Checking..." : "Check with the provider"}
                    </button>
                </div>
            )}
        </li>
    )
}

// Every refund, newest first, with a way to ask the provider where one stands and to issue another.
function AdminRefundsPage() {
    useDocumentTitle("Refunds")
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState<StatusFilter>("")
    const { state, setData, reload } = useApiResource(`${page}:${status}`, (signal) => listAdminRefunds(page, status, signal))
    const [searchParams] = useSearchParams()
    const orderFromSearch = (searchParams.get("order") ?? "").replace(/\D/g, "")// an order chosen on an order's page
    const [isFormOpen, setIsFormOpen] = useState(orderFromSearch !== "")

    function replaceRefund(updated: AdminRefund) {
        setData((data) => ({ ...data, refunds: data.refunds.map((refund) => refund.id === updated.id ? updated : refund) }))
    }

    return (
        <div className="admin-page">
            <AdminListHead
                title="Refunds"
                intro="Every refund sent to a buyer, newest first. Ones that failed or need checking show what went wrong."
                action={!isFormOpen && (
                    <button type="button" className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
                        <Plus size={16} aria-hidden="true" />Issue a refund
                    </button>
                )}
            />

            {isFormOpen && <IssueRefundForm key={orderFromSearch} initialOrderId={orderFromSearch} onIssued={reload} onClose={() => setIsFormOpen(false)} />}

            <div className="admin-tools">
                <AdminFilters label="Show" options={STATUS_FILTERS} value={status} onChange={(value) => { setStatus(value); setPage(1) }} />
            </div>

            {state.kind === "loading" && <p role="status">Loading refunds...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    <p className="admin-count">
                        <span><b>{state.data.total.toLocaleString("en-NG")}</b> {state.data.total === 1 ? "refund" : "refunds"}</span>
                        <span>{pageOf(page, state.data.pageSize, state.data.total)}</span>
                    </p>
                    {state.data.refunds.length === 0 ? <div className="orders-none"><p>No refunds here.</p></div> : (
                        <ul className="admin-cards">
                            {state.data.refunds.map((refund) => <RefundCard key={refund.id} refund={refund} onChanged={replaceRefund} />)}
                        </ul>
                    )}
                    <AdminPager page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
                </>
            )}
        </div>
    )
}

export default AdminRefundsPage
