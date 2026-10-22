import { Link } from "react-router-dom"
import Notice from "./Notice"
import { fetchMyStanding } from "../lib/standingApi"
import { formatShortDate } from "../lib/orderApi"
import { useApiResource } from "../lib/useApiResource"

// What a seller needs to know about their standing, at the top of My store. Nothing is shown while
// there is nothing to say: only a warning, a block, or strikes that are building up.
function SellerStandingNotice() {
    const { state } = useApiResource("my-standing", (signal) => fetchMyStanding(signal))

    if (state.kind !== "ready") {
        return null// a failed check should not get in the way of the page
    }

    const { standing } = state.data

    if (standing.blocked) {
        return (
            <Notice kind="error">
                <p><strong>Your shop is blocked.</strong> Shoppers cannot see it or buy from it, and it takes no new pre-orders.</p>
                {standing.blockReason && <p>Reason: {standing.blockReason}</p>}
                <p>Orders you already have carry on: you can still ship them, answer complaints and see your earnings. To have the block lifted, contact Vendly.</p>
            </Notice>
        )
    }

    if (standing.strikes === 0) {
        return null
    }

    return (
        <Notice kind={standing.warned ? "warning" : "info"}>
            <p>
                <strong>
                    {standing.warned ? "Warning: " : ""}
                    {standing.strikes} {standing.strikes === 1 ? "complaint" : "complaints"} lost in the last {standing.windowDays} days.
                </strong>
                {" "}At {standing.blockAt}, your shop is blocked and shoppers can no longer see it or buy from it.
            </p>
            <p>A complaint counts against you when Vendly decides it in the buyer's favour and you did not agree to the refund yourself. Answer complaints quickly and fairly to avoid this.</p>
            <ul>
                {standing.recent.map((strike) => (
                    <li key={strike.disputeId}>
                        <Link to={`/seller/disputes/${strike.disputeId}`}>Complaint {strike.disputeId}</Link> (order {strike.orderId}), decided {formatShortDate(strike.resolvedAt)}
                    </li>
                ))}
            </ul>
        </Notice>
    )
}

export default SellerStandingNotice
