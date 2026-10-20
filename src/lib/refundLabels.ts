import type { RefundStatus } from "../types/refund"

const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
    PENDING: "Being submitted",
    PROCESSING: "Processing",
    NEEDS_ATTENTION: "Needs attention",
    SUCCEEDED: "Refunded",
    FAILED: "Failed"
}

export function formatRefundStatus(status: string): string {
    return REFUND_STATUS_LABELS[status as RefundStatus] ?? status
}
