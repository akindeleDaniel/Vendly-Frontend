import { Link } from "react-router-dom"
import Notice from "./Notice"
import { fetchMyStanding } from "../lib/standingApi"
import { formatShortDate } from "../lib/orderApi"
import { formatNaira } from "../lib/money"
import { useApiResource } from "../lib/useApiResource"

// Shoppers are not told why; the seller is, so they can put it right.
function OrdersPausedNotice({ amountOwed }: { amountOwed: string }) {
    return (
        <Notice kind="warning">
            <p><strong>New orders are paused until you repay what you owe for refunds.</strong> You owe {formatNaira(amountOwed)}.</p>
            <p>Your shop stays visible, and the orders you already have carry on as normal.</p>
            <Link to="/seller/liabilities" className="btn">See what you owe</Link>
        </Notice>
    )
}

// What a seller needs to know about their standing, at the top of My store. Nothing is shown while
// there is nothing to say: only paused orders, a warning, a block, or strikes that are building up.
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
                <p>Orders you already have carry on: you can still ship them, answer complaints and see your earnings. To have the block lifted, contact StoreHatch.</p>
            </Notice>
        )
    }

    const paused = standing.debt?.ordersPaused ? <OrdersPausedNotice amountOwed={standing.debt.amountOwed} /> : null

    if (standing.strikes === 0) {
        return paused
    }

    return (
        <>
        {paused}
        <Notice kind={standing.warned ? "warning" : "info"}>
            <p>
                <strong>
                    {standing.warned ? "Warning: " : ""}
                    {standing.strikes} {standing.strikes === 1 ? "complaint" : "complaints"} lost in the last {standing.windowDays} days.
                </strong>
                {" "}At {standing.blockAt}, your shop is blocked and shoppers can no longer see it or buy from it.
            </p>
            <p>A complaint counts against you when StoreHatch decides it in the buyer's favour and you did not agree to the refund yourself. Answer complaints quickly and fairly to avoid this.</p>
            <ul>
                {standing.recent.map((strike) => (
                    <li key={strike.disputeId}>
                        <Link to={`/seller/disputes/${strike.disputeId}`}>Complaint {strike.disputeId}</Link> (order {strike.orderId}), decided {formatShortDate(strike.resolvedAt)}
                    </li>
                ))}
            </ul>
        </Notice>
        </>
    )
}

export default SellerStandingNotice
