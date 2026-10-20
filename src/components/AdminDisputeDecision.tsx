import { useId, useState } from "react"
import { Link } from "react-router-dom"
import Notice from "./Notice"
import { parseOptionalNaira } from "../lib/amountInput"
import { approveDispute, rejectDispute } from "../lib/disputeApi"
import { readRefundFailure } from "../lib/refundErrors"
import type { RefundFailure } from "../lib/refundErrors"
import { failureMessage } from "../lib/apiRequest"
import { formatRefundStatus } from "../lib/refundLabels"
import type { Dispute } from "../types/dispute"

type Decision = "APPROVE" | "REJECT"

// An administrator's decision on a complaint: approve a refund (all or part of it) or reject it.
function AdminDisputeDecision({ dispute, onUpdated }: { dispute: Dispute, onUpdated: (dispute: Dispute) => void }) {
    const decisionName = useId()
    const [decision, setDecision] = useState<Decision | null>(null)
    const [note, setNote] = useState("")
    const [amount, setAmount] = useState("")
    const [customerNote, setCustomerNote] = useState("")
    const [restock, setRestock] = useState<"" | "true" | "false">("")
    const [chargeSeller, setChargeSeller] = useState(true)
    const [acknowledgeLowBalance, setAcknowledgeLowBalance] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")
    const [failure, setFailure] = useState<RefundFailure | null>(null)
    const [approvedMessage, setApprovedMessage] = useState("")

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (decision === null || isSending) {
            return
        }

        if (note.trim().length < 3) {
            setError("Add a note of at least 3 characters. It is saved with the decision.")
            return
        }

        setError("")
        setFailure(null)

        if (decision === "REJECT") {
            setIsSending(true)
            const result = await rejectDispute(dispute.id, note.trim())
            setIsSending(false)

            if (result.kind === "ok") {
                onUpdated(result.data.dispute)
            } else {
                setError(failureMessage(result))
            }
            return
        }

        const parsedAmount = parseOptionalNaira(amount)
        if (!parsedAmount.ok) {
            setError(parsedAmount.message)
            return
        }

        setIsSending(true)
        const result = await approveDispute(dispute.id, {
            note: note.trim(),
            amount: parsedAmount.value,
            customerNote: customerNote.trim() || undefined,
            restock: restock === "" ? undefined : restock === "true",
            chargeSeller,
            acknowledgeLowBalance
        })
        setIsSending(false)

        if (result.kind === "ok") {
            setApprovedMessage(`Refund ${formatRefundStatus(result.data.refund.status).toLowerCase()}.`)
            onUpdated(result.data.dispute)
        } else {
            const readFailure = readRefundFailure(result)
            setFailure(readFailure)
            setError(readFailure.message)
        }
    }

    return (
        <section aria-labelledby="decision-heading" className="card summary-card">
            <h2 id="decision-heading">Your decision</h2>
            {approvedMessage && <Notice kind="success">{approvedMessage}</Notice>}
            <form onSubmit={handleSubmit} className="dispute-form">
                <fieldset className="choice-fieldset">
                    <legend>Decide this complaint</legend>
                    <label className="checkbox-label">
                        <input type="radio" name={decisionName} checked={decision === "APPROVE"} disabled={isSending} onChange={() => setDecision("APPROVE")} />
                        Approve a refund
                    </label>
                    <label className="checkbox-label">
                        <input type="radio" name={decisionName} checked={decision === "REJECT"} disabled={isSending} onChange={() => setDecision("REJECT")} />
                        Reject the complaint
                    </label>
                </fieldset>

                {decision !== null && (
                    <label>
                        Note for the record (shown in the conversation)
                        <textarea value={note} maxLength={300} disabled={isSending} onChange={(event) => setNote(event.target.value)} />
                    </label>
                )}

                {decision === "APPROVE" && (
                    <>
                        <label>
                            Amount to refund in naira (leave empty for what the buyer asked for)
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
                    </>
                )}

                {error && (
                    <Notice kind="error">
                        <p>{error}</p>
                        {failure?.unknownReference && <p>Reference: {failure.unknownReference}</p>}
                        {failure?.unknownReference && <Link to="/admin/refunds">Open the refunds list</Link>}
                    </Notice>
                )}
                <button type="submit" disabled={decision === null || isSending || (failure?.lowBalance === true && !acknowledgeLowBalance)}>
                    {isSending ? "Saving..." : decision === "REJECT" ? "Reject complaint" : "Approve refund"}
                </button>
            </form>
        </section>
    )
}

export default AdminDisputeDecision
