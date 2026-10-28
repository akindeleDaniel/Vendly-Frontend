import { CalendarDays, MessagesSquare, PackageCheck, ShieldCheck } from "lucide-react"
import type { ShopTrust } from "../types/trust"
import { LAGOS_TIME_ZONE } from "../lib/lagosTime"

type ShopTrustFactsProps = {
    trust: ShopTrust
    // A short version for shop rows and the product page: deliveries and the verified payout only.
    compact?: boolean
    // Separate cards with a short note under each, for the top of the shop page.
    cards?: boolean
}

function plural(count: number, one: string, many: string): string {
    return `${count.toLocaleString("en-NG")} ${count === 1 ? one : many}`
}

function sellingSince(isoTime: string): string | null {
    const date = new Date(isoTime)
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-NG", { timeZone: LAGOS_TIME_ZONE, month: "long", year: "numeric" })
}

function complaintsLine(trust: ShopTrust): string | null {
    const total = trust.complaintsSettled + trust.complaintsOpen

    if (total === 0) {
        // "No complaints" only means something once the shop has delivered something.
        return trust.confirmedDeliveries > 0 ? "No complaints" : null
    }

    if (trust.complaintsOpen === 0) {
        return total === 1 ? "1 complaint, settled" : `${plural(total, "complaint", "complaints")}, all settled`
    }

    return `${plural(total, "complaint", "complaints")}: ${trust.complaintsSettled} settled, ${trust.complaintsOpen} open`
}

// What earlier buyers' orders say about a shop. A zero that would look discouraging is shown as "New shop".
function ShopTrustFacts({ trust, compact = false, cards = false }: ShopTrustFactsProps) {
    const since = sellingSince(trust.sellingSince)
    const complaints = complaintsLine(trust)
    const delivered = trust.confirmedDeliveries > 0

    if (cards) {
        return (
            <ul className="trust-cards">
                <li>
                    <PackageCheck aria-hidden="true" size={22} />
                    <span><b>{delivered ? `${plural(trust.confirmedDeliveries, "order", "orders")} delivered` : "New shop"}</b>{delivered ? "Confirmed by buyers" : "No delivered orders yet"}</span>
                </li>
                {trust.payoutVerified && (
                    <li><ShieldCheck aria-hidden="true" size={22} /><span><b>Payout verified</b>Bank account checked</span></li>
                )}
                {since && (
                    <li><CalendarDays aria-hidden="true" size={22} /><span><b>Since {since}</b>Selling on StoreHatch</span></li>
                )}
                {complaints && (
                    <li><MessagesSquare aria-hidden="true" size={22} /><span><b>{complaints}</b>{complaints === "No complaints" ? "From buyers so far" : "Raised by buyers"}</span></li>
                )}
            </ul>
        )
    }

    return (
        <ul className={compact ? "trust-facts is-compact" : "trust-facts"}>
            <li>
                <PackageCheck aria-hidden="true" size={18} />
                {trust.confirmedDeliveries > 0 ? `${plural(trust.confirmedDeliveries, "order", "orders")} delivered` : "New shop"}
            </li>
            {trust.payoutVerified && (
                <li><ShieldCheck aria-hidden="true" size={18} />Verified payout account</li>
            )}
            {!compact && since && (
                <li><CalendarDays aria-hidden="true" size={18} />Selling since {since}</li>
            )}
            {!compact && complaints && (
                <li><MessagesSquare aria-hidden="true" size={18} />{complaints}</li>
            )}
        </ul>
    )
}

export default ShopTrustFacts
