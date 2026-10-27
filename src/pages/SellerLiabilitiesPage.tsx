import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import { formatOrderDay } from "../lib/buyerOrders"
import { formatNaira } from "../lib/money"
import { acceptPayoutTerms, fetchSellerLiabilities } from "../lib/payoutApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { LiabilityStatus, SellerLiabilities, SellerLiability } from "../types/refund"

type LoadState =
    | { kind: "loading" }
    | { kind: "ready", data: SellerLiabilities }
    | { kind: "no-store" }
    | { kind: "error", message: string }

type Filter = "open" | "closed" | "all"

const STATUS_LABELS: Record<LiabilityStatus, string> = {
    OPEN: "Still owed",
    CLEARED: "Paid back",
    WRITTEN_OFF: "Written off",
    VOID: "Cancelled"
}

const FILTERS: Array<{ value: Filter, label: string }> = [
    { value: "open", label: "Still owed" },
    { value: "closed", label: "Paid back" },
    { value: "all", label: "All" }
]

const LEAD = "When a buyer is refunded after you've been paid, the refund is charged to you. StoreHatch takes it back from your later sales, a little at a time, and shows every deduction here."

function percentPaid(recovered: string, amount: string): number {
    const total = Number(amount)
    return total > 0 ? Math.min(100, Math.round((Number(recovered) / total) * 100)) : 0
}

function LiabilityCard({ liability }: { liability: SellerLiability }) {
    const paid = percentPaid(liability.recovered, liability.amount)
    const count = liability.recoveries.length

    return (
        <article className="owed-card">
            <div className="owed-card-head">
                <h2>{liability.orderId ? <Link to={`/seller/orders/${liability.orderId}`}>Order #{liability.orderId}</Link> : "Refund"}</h2>
                <span className={`review-pill ${liability.status === "OPEN" ? "is-reported" : liability.status === "CLEARED" ? "is-done" : "is-hidden"}`}>{STATUS_LABELS[liability.status]}</span>
                <span className="owed-card-date">Refunded {formatOrderDay(liability.createdAt, { year: true })}</span>
            </div>
            {liability.reason && <p className="owed-card-reason">{liability.reason}</p>}
            <dl className="owed-numbers">
                <div><dt>Refunded to the buyer</dt><dd>{formatNaira(liability.amount)}</dd></div>
                <div><dt>Paid back so far</dt><dd>{formatNaira(liability.recovered)}</dd></div>
                <div><dt>Still to pay back</dt><dd>{formatNaira(liability.remaining)}</dd></div>
            </dl>
            <div className="owed-progress" role="img" aria-label={`${paid}% paid back`}><i style={{ width: `${paid}%` }} /></div>
            {count > 0 && (
                <details className="owed-deductions">
                    <summary>{count === 1 ? "1 deduction so far" : `${count} deductions so far`}</summary>
                    <ul>
                        {liability.recoveries.map((recovery, index) => (
                            <li key={index}>
                                <span>
                                    {formatOrderDay(recovery.createdAt, { year: true })} ·{" "}
                                    {recovery.orderId ? <>from <Link to={`/seller/orders/${recovery.orderId}`}>order #{recovery.orderId}</Link></> : recovery.note ?? "collected by StoreHatch"}
                                </span>
                                <b>−{formatNaira(recovery.amount)}</b>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </article>
    )
}

// What a seller owes StoreHatch after refunds, and every deduction taken from their sales so far, so
// money kept back is never a surprise.
function SellerLiabilitiesPage() {
    useDocumentTitle("Refunds owed")
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const [attempt, setAttempt] = useState(0)
    const [filter, setFilter] = useState<Filter>("open")
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

    const top = (
        <>
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="product-form-title">
                <h1>Refunds owed</h1>
                <p>{LEAD}</p>
            </div>
        </>
    )

    if (state.kind === "loading") {
        return <div className="money-page">{top}<p role="status">Loading...</p></div>
    }

    if (state.kind === "no-store") {
        return (
            <div className="money-page">
                {top}
                <Notice kind="info">
                    <p>Set up your store first.</p>
                    <Link to="/seller/onboarding" className="btn">Set up my store</Link>
                </Notice>
            </div>
        )
    }

    if (state.kind === "error") {
        return (
            <div className="money-page">
                {top}
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((count) => count + 1) }}>Try again</button>
                </Notice>
            </div>
        )
    }

    const { data } = state
    const open = data.liabilities.filter((liability) => liability.status === "OPEN")
    const closed = data.liabilities.filter((liability) => liability.status !== "OPEN")
    const shown = filter === "open" ? open : filter === "closed" ? closed : data.liabilities
    const openTotal = open.reduce((sum, liability) => sum + Number(liability.amount), 0)
    const openRecovered = open.reduce((sum, liability) => sum + Number(liability.recovered), 0)
    const paid = openTotal > 0 ? Math.round((openRecovered / openTotal) * 100) : 0
    const counts: Record<Filter, number> = { open: open.length, closed: closed.length, all: data.liabilities.length }

    return (
        <div className="money-page">
            {top}

            <div className="owed-top">
                <div className="owed-total">
                    <small>Still owed</small>
                    <b>{formatNaira(data.outstanding)}</b>
                    {openTotal > 0 && (
                        <>
                            <div className="owed-progress" role="img" aria-label={`${paid}% paid back`}><i style={{ width: `${paid}%` }} /></div>
                            <p className="owed-total-line"><span>{formatNaira(openRecovered.toFixed(2))} paid back</span><span>of {formatNaira(openTotal.toFixed(2))} refunded</span></p>
                        </>
                    )}
                    <p className="product-help">Nothing is taken from your bank account. It only comes out of your next sales.</p>
                </div>
                <section className="money-card" aria-labelledby="how-heading">
                    <h2 id="how-heading" className="money-side-title">How it's paid back</h2>
                    <ol className="owed-how">
                        <li><span aria-hidden="true">1</span>A buyer is refunded for one of your orders after you were paid.</li>
                        <li><span aria-hidden="true">2</span>From each later sale, StoreHatch keeps at most <b>{data.deductionCapPercent}%</b> of your share until it's paid back.</li>
                        <li><span aria-hidden="true">3</span>Each deduction shows here and on the order it came from.</li>
                    </ol>
                </section>
            </div>

            {!data.termsAccepted && (
                <section aria-labelledby="accept-terms-heading" className="money-card owed-terms">
                    <h2 id="accept-terms-heading">Accept the payout terms</h2>
                    <p className="product-help">Nothing is kept back from your sales until you accept the current terms. Refunds you owe stay on this page.</p>
                    <div className="settings-terms" tabIndex={0} aria-label="Payout terms">{data.feeTerms.text}</div>
                    <label className="settings-check">
                        <input type="checkbox" checked={accepted} disabled={isAccepting} onChange={(event) => setAccepted(event.target.checked)} />
                        I have read and accept these payout terms
                    </label>
                    {termsError && <Notice kind="error">{termsError}</Notice>}
                    <div className="settings-actions">
                        <button type="button" className="btn btn-primary" disabled={!accepted || isAccepting} onClick={handleAccept}>
                            {isAccepting ? "Saving..." : "Accept the terms"}
                        </button>
                    </div>
                </section>
            )}

            <div className="money-chips" role="group" aria-label="Show">
                {FILTERS.map((option) => (
                    <button key={option.value} type="button" className={`money-chip${filter === option.value ? " is-on" : ""}`} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
                        {option.label}<span className="money-chip-count">{counts[option.value]}</span>
                    </button>
                ))}
            </div>

            {shown.length === 0 ? (
                <div className="money-empty">
                    <b>Nothing here</b>
                    {filter === "closed" ? "No refunds have been paid back yet." : "You don't owe anything for refunds."}
                </div>
            ) : (
                <div className="owed-list">
                    {shown.map((liability) => <LiabilityCard key={liability.id} liability={liability} />)}
                </div>
            )}
        </div>
    )
}

export default SellerLiabilitiesPage
