import { describePreOrder } from "../lib/preOrderApi"
import type { PreOrderViewer } from "../lib/preOrderApi"
import type { PreOrderStatus } from "../types/preOrder"

const TONE_CLASSES = {
    neutral: "badge",
    attention: "badge badge-warning",
    good: "badge",
    bad: "badge badge-error"
} as const

// The state of a pre-order request in words, coloured by how much it needs the viewer's attention.
function PreOrderBadge({ preOrder, viewer }: { preOrder: { status: PreOrderStatus }, viewer: PreOrderViewer }) {
    const { label, tone } = describePreOrder(preOrder, viewer)
    return <span className={TONE_CLASSES[tone]}>{label}</span>
}

export default PreOrderBadge
