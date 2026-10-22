import { formatShortDate } from "../lib/orderApi"
import type { Fulfilment } from "../types/order"

type FulfilmentTimelineProps = {
    status: string
    paidAt: string | null
    fulfilment: Fulfilment
    viewer: "buyer" | "seller"
}

type StepState = "done" | "attention" | "pending"

type Step = {
    key: string
    label: string
    state: StepState
    date: string | null
    note: string | null
}

const STATE_WORDS: Record<StepState, string> = {
    done: "Completed",
    attention: "Needs confirmation",
    pending: "Not reached yet"
}

function CheckIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <polyline points="5,12.5 10,17.5 19,7" />
        </svg>
    )
}

// The latest moment anything happened to the order, for the "Last updated" line.
function latestOf(times: Array<string | null>): string | null {
    let latest: string | null = null

    for (const time of times) {
        if (time !== null && (latest === null || new Date(time).getTime() > new Date(latest).getTime())) {
            latest = time
        }
    }

    return latest
}

// An order's progress as three steps: Paid, Shipped and Delivered. The seller reports delivery, but
// the step only becomes complete once the buyer confirms receipt: until then it asks for attention.
function FulfilmentTimeline({ status, paidAt, fulfilment, viewer }: FulfilmentTimelineProps) {
    const { shippedAt, shippingNote, deliveryReportedAt, deliveryConfirmedAt } = fulfilment
    const deliveryAutoClosedAt = fulfilment.deliveryAutoClosedAt ?? null

    if (status === "REFUNDED" || status === "CANCELLED") {
        return <p className="stepper-closed">{status === "REFUNDED" ? "This order was refunded." : "This order was cancelled."}</p>
    }

    const isReported = deliveryReportedAt !== null || deliveryConfirmedAt !== null
    const isConfirmed = deliveryConfirmedAt !== null || status === "DELIVERED"

    const steps: Step[] = [
        { key: "paid", label: "Paid", state: "done", date: paidAt, note: null },
        {
            key: "shipped",
            label: "Shipped",
            state: shippedAt !== null || isReported ? "done" : "pending",
            date: shippedAt,
            note: null
        },
        {
            key: "delivered",
            label: "Delivered",
            state: isConfirmed ? "done" : isReported ? "attention" : "pending",
            date: deliveryConfirmedAt ?? deliveryAutoClosedAt ?? deliveryReportedAt,
            note: isConfirmed
                ? deliveryConfirmedAt === null && deliveryAutoClosedAt !== null
                    ? "Closed automatically after 7 days"
                    : viewer === "buyer" ? "You confirmed" : "Buyer confirmed"
                : isReported
                    ? viewer === "buyer" ? "Please confirm below" : "Waiting for the buyer to confirm"
                    : null
        }
    ]

    const currentIndex = steps.some((step) => step.state === "attention")
        ? steps.findIndex((step) => step.state === "attention")
        : steps.map((step) => step.state).lastIndexOf("done")
    const lastUpdated = latestOf([paidAt, shippedAt, deliveryReportedAt, deliveryConfirmedAt, deliveryAutoClosedAt])

    return (
        <div className="stepper-wrap">
            <ol className="stepper" aria-label="Order progress">
                {steps.map((step, index) => {
                    const next = steps[index + 1]
                    const linkClass = next && next.state !== "pending" ? ` link-${next.state}` : ""

                    return (
                        <li
                            key={step.key}
                            className={`stepper-step is-${step.state}${linkClass}`}
                            aria-current={index === currentIndex ? "step" : undefined}
                        >
                            <span className="stepper-dot" aria-hidden="true">
                                {step.state === "done" ? <CheckIcon /> : step.state === "attention" ? "!" : index + 1}
                            </span>
                            <span className="stepper-label">
                                <span className="visually-hidden">{STATE_WORDS[step.state]}: </span>
                                {step.label}
                            </span>
                            {step.date && <span className="stepper-time">{formatShortDate(step.date)}</span>}
                            {step.note && <span className="stepper-note">{step.note}</span>}
                        </li>
                    )
                })}
            </ol>
            {shippingNote && (
                <p className="stepper-shipping-note">
                    <strong>{viewer === "buyer" ? "Note from the seller" : "Your note to the buyer"}:</strong> {shippingNote}
                </p>
            )}
            {lastUpdated && <p className="stepper-updated">Last updated {formatShortDate(lastUpdated)}</p>}
        </div>
    )
}

export default FulfilmentTimeline
