import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { fetchComplaintsAwaitingSeller, fetchUnreadComplaintCount } from "../lib/disputeApi"
import { fetchPreOrdersAwaitingAnswer } from "../lib/preOrderApi"

// A seller's way back to My store from anywhere, with a count when a complaint or pre-order is
// waiting for them. Everything else a seller does is reached from My store.
function SellerStoreLink() {
    const { pathname } = useLocation()
    const [waiting, setWaiting] = useState(0)

    // Checked when the seller moves between pages, so the count follows what they answer.
    useEffect(() => {
        const controller = new AbortController()

        Promise.all([
            fetchComplaintsAwaitingSeller(controller.signal),
            fetchUnreadComplaintCount("seller", controller.signal),
            fetchPreOrdersAwaitingAnswer(controller.signal)
        ]).then(([toAnswer, unread, preOrders]) => {
            if (!controller.signal.aborted) {
                setWaiting((toAnswer ?? 0) + (unread ?? 0) + (preOrders ?? 0))
            }
        })

        return () => controller.abort()
    }, [pathname])

    if (pathname === "/seller/myListing") {
        return null
    }

    return (
        <Link to="/seller/myListing" className="header-link">
            My store
            {waiting > 0 && <span className="count-badge" aria-label={`${waiting} waiting for you`}>{waiting}</span>}
        </Link>
    )
}

export default SellerStoreLink
