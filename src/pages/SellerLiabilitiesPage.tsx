import { useEffect, useState } from "react"
import BackArrow from "../components/BackArrow"
import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { formatShortDate } from "../lib/orderApi"
import { acceptPayoutTerms, fetchSellerLiabilities } from "../lib/payoutApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { LiabilityStatus, SellerLiabilities } from "../types/refund"

type LoadState =
    | { kind: "loading" }
    | { kind: "ready", data: SellerLiabilities }
    | { kind: "no-store" }
    | { kind: "error", message: string }

const STATUS_LABELS: Record<LiabilityStatus, string> = {
    OPEN: "Still owed",
    CLEARED: "Paid back",
    WRITTEN_OFF: "Written off",
    VOID: "Cancelled"
}

// What a seller owes StoreHatch after refunds, and every deduction taken from their sales so far, so
// money kept back is never a surprise.
function SellerLiabilitiesPage() {
    useDocumentTitle("Refunds and amounts owed")
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const [attempt, setAttempt] = useState(0)
    const [accepted, setAccepted] = useState(false)
    const [isAccepting, setIsAccepting] = useState(false)
    const [termsError, setTermsError] = useState("")

    useEffect(() => {
        const controller = new AbortController()

        fetchSellerLiabilities(controller.signal).then((result) => {
            if (controller.signal.aborted) {
                return
            }

            if (result.kind === "ok") {
                setState({ kind: "ready", data: result.data })
            } else if (result.kind === "failed" && result.status === 404) {
                setState({ kind: "no-store" })
            } else if (result.kind !== "unauthorized") {
                setState({ kind: "error", message: failureMessage(result) })
            }
        })

        return () => controller.abort()
    }, [attempt])

    async function handleAccept() {
        if (state.kind !== "ready" || !accepted || isAccepting) {
            return
        }

        setIsAccepting(true)
        setTermsError("")
        const outcome = await acceptPayoutTerms(state.data.feeTerms.version)
        setIsAccepting(false)

        if (outcome.kind === "ok") {
            setAccepted(false)
            setAttempt((count) => count + 1)
        } else if (outcome.kind === "outdated" || outcome.kind === "error") {
            setTermsError(outcome.message)
            setAttempt((count) => count + 1)
        }
    }

    const back = <BackArrow to="/seller/payouts" label="Back to payout settings" />

    if (state.kind === "loading") {
        return <p role="status">Loading...</p>
    }

    if (state.kind === "no-store") {
        return (
            <div>
                {back}
                <h1>Refunds and amounts owed</h1>
                <Notice kind="info">
                    <p>Set up your store first.</p>
                    <Link to="/seller/onboarding" className="btn">Set up my store</Link>
                </Notice>
            </div>
        )
    }

    if (state.kind === "error") {
        return (
            <div>
                {back}
                <h1>Refunds and amounts owed</h1>
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((count) => count + 1) }}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { data } = state

    return (
        <div className="form-page-wide">
            {back}
            <h1>Refunds and amounts owed</h1>
            <p className="page-intro">
                When a buyer is refunded for one of your orders, the refund is charged to you. StoreHatch recovers it from your later sales, keeping at most {data.deductionCapPercent}% of each sale until it is paid back.
            </p>

            {!data.termsAccepted && (
                <section aria-labelledby="accept-terms-heading" className="card form-card">
                    <h2 id="accept-terms-heading">Accept the payout terms</h2>
                    <Notice kind="warning">Nothing is kept back from your sales until you accept the current terms. Refunds you owe stay on this page.</Notice>
                    <p className="terms-text">{data.feeTerms.text}</p>
                    <label className="checkbox-label">
                        <input type="checkbox" checked={accepted} disabled={isAccepting} onChange={(event) => setAccepted(event.target.checked)} />
                        I have read and accept these payout terms
                    </label>
                    {termsError && <Notice kind="error">{termsError}</Notice>}
                    <button type="button" className="btn btn-primary" disabled={!accepted || isAccepting} onClick={handleAccept}>
                        {isAccepting ? "Saving..." : "Accept the terms"}
                    </button>
                </section>
            )}

            <section aria-labelledby="owed-heading" className="card summary-card">
                <h2 id="owed-heading">Still owed</h2>
                <p className="owed-amount">{formatNaira(data.outstanding)}</p>
            </section>

            {data.liabilities.length === 0 ? (
                <p>You do not owe anything for refunds.</p>
            ) : (
                <ul className="order-history">
                    {data.liabilities.map((liability) => (
                        <li key={liability.id} className="card order-card">
                            <div className="order-header">
                                <h2>{liability.orderId ? <Link to={`/seller/orders/${liability.orderId}`}>Order {liability.orderId}</Link> : "Refund"}</h2>
                                <span className={liability.status === "OPEN" ? "badge badge-warning" : "badge"}>{STATUS_LABELS[liability.status]}</span>
                            </div>
                            {liability.reason && <p className="order-line-meta">{liability.reason}</p>}
                            <div className="summary-row"><span>Refunded to the buyer</span><span>{formatNaira(liability.amount)}</span></div>
                            <div className="summary-row"><span>Already recovered</span><span>{formatNaira(liability.recovered)}</span></div>
                            <div className="summary-row summary-row-total"><span>Still to recover</span><span>{formatNaira(liability.remaining)}</span></div>
                            {liability.recoveries.length > 0 && (
                                <div className="order-extras">
                                    <h3 className="order-section-title">Deductions so far</h3>
                                    <ul className="deduction-list">
                                        {liability.recoveries.map((recovery, index) => (
                                            <li key={index}>
                                                <span>
                                                    {formatShortDate(recovery.createdAt)} ·{" "}
                                                    {recovery.orderId ? `from order ${recovery.orderId}` : recovery.note ?? "collected by StoreHatch"}
                                                </span>
                                                <strong>−{formatNaira(recovery.amount)}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default SellerLiabilitiesPage
