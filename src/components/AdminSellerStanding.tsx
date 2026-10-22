import { useState } from "react"
import { Link } from "react-router-dom"
import InlineConfirm from "./InlineConfirm"
import Notice from "./Notice"
import { failureMessage } from "../lib/apiRequest"
import { MESSAGE_MAX_LENGTH, validateMessage } from "../lib/disputeMessage"
import { formatShortDate } from "../lib/orderApi"
import { blockSeller, fetchSellerStanding, unblockSeller } from "../lib/standingApi"
import { useApiResource } from "../lib/useApiResource"

// A seller's standing for an administrator: lost complaints, whether the shop is warned or blocked, and
// the buttons to block it by hand or lift a block. Lifting a block starts the strike count again.
function AdminSellerStanding({ userId }: { userId: number }) {
    const { state, setData, reload } = useApiResource(String(userId), (signal) => fetchSellerStanding(userId, signal))
    const [isBlocking, setIsBlocking] = useState(false)
    const [note, setNote] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")

    if (state.kind === "loading") {
        return <p role="status">Loading the shop's standing...</p>
    }

    if (state.kind === "error") {
        return (
            <Notice kind="error">
                <p>{state.message}</p>
                <button type="button" onClick={reload}>Try again</button>
            </Notice>
        )
    }

    const { standing } = state.data

    async function handleBlock(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isWorking) {
            return
        }

        const problem = validateMessage(note, "note")
        if (problem) {
            setError(problem)
            return
        }

        setIsWorking(true)
        setError("")
        const result = await blockSeller(userId, note.trim())
        setIsWorking(false)

        if (result.kind === "ok") {
            setData(() => result.data)
            setIsBlocking(false)
            setNote("")
        } else {
            setError(failureMessage(result))
        }
    }

    async function handleUnblock(): Promise<string | null> {
        const result = await unblockSeller(userId)

        if (result.kind === "ok") {
            setData(() => result.data)
            return null
        }

        return failureMessage(result)
    }

    return (
        <section aria-labelledby="standing-heading" className="card summary-card">
            <div className="order-header">
                <h2 id="standing-heading">Shop standing</h2>
                {standing.blocked
                    ? <span className="badge badge-error">Blocked</span>
                    : standing.warned ? <span className="badge badge-warning">Warned</span> : <span className="badge">Good standing</span>}
            </div>
            <dl className="detail-list">
                <div><dt>Lost complaints</dt><dd>{standing.strikes} in the last {standing.windowDays} days (warned at {standing.warnAt}, blocked at {standing.blockAt})</dd></div>
                {standing.blocked && standing.blockedAt && <div><dt>Blocked</dt><dd>{formatShortDate(standing.blockedAt)}</dd></div>}
                {standing.blocked && standing.blockReason && <div><dt>Reason</dt><dd>{standing.blockReason}</dd></div>}
            </dl>
            {standing.recent.length > 0 && (
                <ul>
                    {standing.recent.map((strike) => (
                        <li key={strike.disputeId}>
                            <Link to={`/admin/complaints/${strike.disputeId}`}>Complaint {strike.disputeId}</Link> (<Link to={`/admin/orders/${strike.orderId}`}>order {strike.orderId}</Link>), decided {formatShortDate(strike.resolvedAt)}
                        </li>
                    ))}
                </ul>
            )}

            {standing.blocked ? (
                <InlineConfirm
                    buttonLabel="Lift the block"
                    prompt="Lift this block? The shop becomes visible again and its strike count starts again from zero."
                    confirmLabel="Yes, lift it"
                    onConfirm={handleUnblock}
                />
            ) : isBlocking ? (
                <form onSubmit={handleBlock} className="dispute-form">
                    <p className="field-help">A blocked shop is hidden from shoppers and cannot be bought from. Orders already placed carry on. The seller is emailed and shown your note.</p>
                    <label>
                        Why is this shop being blocked?
                        <textarea value={note} maxLength={MESSAGE_MAX_LENGTH} disabled={isWorking} onChange={(event) => setNote(event.target.value)} />
                    </label>
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="action-row">
                        <button type="submit" className="btn btn-danger" disabled={isWorking}>{isWorking ? "Blocking..." : "Block this shop"}</button>
                        <button type="button" onClick={() => { setIsBlocking(false); setError("") }} disabled={isWorking}>Cancel</button>
                    </div>
                </form>
            ) : (
                <button type="button" onClick={() => setIsBlocking(true)}>Block this shop</button>
            )}
        </section>
    )
}

export default AdminSellerStanding
