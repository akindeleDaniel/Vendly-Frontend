import { describeDispute } from "../lib/disputeApi"
import type { DisputeViewer } from "../lib/disputeApi"
import type { DisputeOutcome, DisputeStatus } from "../types/dispute"

const TONE_CLASSES = {
    neutral: "badge",
    attention: "badge badge-warning",
    good: "badge",
    bad: "badge badge-error"
} as const

// The status of a complaint in words, coloured by how much it needs the viewer's attention.
function DisputeBadge({ dispute, viewer }: { dispute: { status: DisputeStatus, outcome: DisputeOutcome | null }, viewer: DisputeViewer }) {
    const { label, tone } = describeDispute(dispute, viewer)
    return <span className={TONE_CLASSES[tone]}>{label}</span>
}

export default DisputeBadge
