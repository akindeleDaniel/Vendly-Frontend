import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { apiRequest } from "../lib/apiRequest"
import { fetchComplaintsAwaitingSeller, fetchUnreadComplaintCount } from "../lib/disputeApi"
import { fetchPreOrdersAwaitingAnswer } from "../lib/preOrderApi"

type Counts = {
    complaintsToAnswer: number
    complaintsNew: number
    preOrdersToAnswer: number
    takesPreOrders: boolean
}

const NO_COUNTS: Counts = { complaintsToAnswer: 0, complaintsNew: 0, preOrdersToAnswer: 0, takesPreOrders: false }

function MenuIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
    )
}

// A seller's menu: a button with three lines that opens everything a seller does. A count on the
// button shows that something is waiting for an answer.
function SellerMenu() {
    const { pathname } = useLocation()
    // The page the menu was opened on: it counts as closed as soon as another page opens.
    const [openedAt, setOpenedAt] = useState<string | null>(null)
    const isOpen = openedAt === pathname
    const [counts, setCounts] = useState<Counts>(NO_COUNTS)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Checked when the seller moves between pages, so the counts follow what they answer.
    useEffect(() => {
        const controller = new AbortController()

        async function load() {
            const [toAnswer, unread, preOrders, profile] = await Promise.all([
                fetchComplaintsAwaitingSeller(controller.signal),
                fetchUnreadComplaintCount("seller", controller.signal),
                fetchPreOrdersAwaitingAnswer(controller.signal),
                apiRequest<{ foodOrderType?: string }>("/seller/profile", { signal: controller.signal })
            ])

            if (controller.signal.aborted) {
                return
            }

            const takesPreOrders = profile.kind === "ok" && (profile.data.foodOrderType === "PRE_ORDER" || profile.data.foodOrderType === "BOTH")
            setCounts({
                complaintsToAnswer: toAnswer ?? 0,
                complaintsNew: unread ?? 0,
                preOrdersToAnswer: preOrders ?? 0,
                // A shop that stopped taking pre-orders still sees them while requests are waiting.
                takesPreOrders: takesPreOrders || (preOrders ?? 0) > 0
            })
        }

        load()
        return () => controller.abort()
    }, [pathname])

    // The menu closes when a page opens, when the seller clicks elsewhere, or on Escape.
    useEffect(() => {
        if (!isOpen) {
            return
        }

        function handlePointer(event: MouseEvent | TouchEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpenedAt(null)
            }
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpenedAt(null)
                buttonRef.current?.focus()
            }
        }

        document.addEventListener("mousedown", handlePointer)
        document.addEventListener("touchstart", handlePointer)
        document.addEventListener("keydown", handleKey)
        return () => {
            document.removeEventListener("mousedown", handlePointer)
            document.removeEventListener("touchstart", handlePointer)
            document.removeEventListener("keydown", handleKey)
        }
    }, [isOpen])

    const links = [
        { to: "/seller/myListing", label: "My store" },
        { to: "/seller/orders", label: "Orders" },
        { to: "/seller/disputes", label: "Complaints" },
        ...(counts.takesPreOrders ? [{ to: "/seller/pre-orders", label: "Pre-orders" }] : []),
        { to: "/seller/earnings", label: "Earnings" },
        { to: "/seller/reviews", label: "Reviews" },
        { to: "/seller/delivery", label: "Delivery" },
        { to: "/seller/payouts", label: "Payouts" },
        { to: "/seller/liabilities", label: "Refunds owed" },
        { to: "/seller/profile/edit", label: "Store details" }
    ]

    const waiting = counts.complaintsToAnswer + counts.complaintsNew + counts.preOrdersToAnswer

    function badgesFor(to: string): ReactNode {
        if (to === "/seller/disputes") {
            return (
                <span className="badge-group">
                    {counts.complaintsToAnswer > 0 && <span className="count-badge" aria-label={`${counts.complaintsToAnswer} waiting for your response`}>{counts.complaintsToAnswer}</span>}
                    {counts.complaintsNew > 0 && <span className="count-badge count-badge-new" aria-label={`${counts.complaintsNew} with something new`}>{counts.complaintsNew} new</span>}
                </span>
            )
        }

        if (to === "/seller/pre-orders" && counts.preOrdersToAnswer > 0) {
            return <span className="count-badge" aria-label={`${counts.preOrdersToAnswer} waiting for your answer`}>{counts.preOrdersToAnswer}</span>
        }

        return null
    }

    return (
        <div className="seller-menu" ref={wrapperRef}>
            <button
                ref={buttonRef}
                type="button"
                className="seller-menu-button"
                aria-expanded={isOpen}
                aria-controls="seller-menu-list"
                onClick={() => setOpenedAt(isOpen ? null : pathname)}
            >
                <MenuIcon />
                <span className="visually-hidden">Menu{waiting > 0 ? `, ${waiting} waiting` : ""}</span>
                {waiting > 0 && <span className="count-badge seller-menu-count" aria-hidden="true">{waiting}</span>}
            </button>
            {isOpen && (
                <nav id="seller-menu-list" aria-label="Your shop" className="seller-menu-panel">
                    <ul>
                        {links.map((link) => (
                            <li key={link.to}>
                                <NavLink to={link.to} className={({ isActive }) => isActive ? "seller-menu-link is-active" : "seller-menu-link"}>
                                    {link.label}
                                    {badgesFor(link.to)}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </div>
    )
}

export default SellerMenu
