import { readyTimeParts } from "../lib/buyerOrders"
import { readyTileTone } from "../lib/preOrderApi"
import type { PreOrder } from "../types/preOrder"

// A pre-order's ready time as a small calendar page: day of the week, date, month and, in a list,
// the time. The words are read from the page's own text, so the tile is hidden from screen readers.
function ReadyTile({ preOrder, large = false }: { preOrder: PreOrder, large?: boolean }) {
    const ready = readyTimeParts(preOrder.readyAt)

    return (
        <span className={`ready-tile is-${readyTileTone(preOrder)}${large ? " is-large" : ""}`} aria-hidden="true">
            <span className="ready-tile-weekday">{ready.weekday}</span>
            <span className="ready-tile-day">{ready.day}</span>
            <span className="ready-tile-month">{ready.month}</span>
            {!large && <span className="ready-tile-time">{ready.time}</span>}
        </span>
    )
}

export default ReadyTile
