import { useEffect, useState } from "react"

const HOUR = 60 * 60 * 1000

function remainingLabel(deadline: string, now: number): string {
    const remaining = new Date(deadline).getTime() - now
    if (!Number.isFinite(remaining) || remaining <= 0) {
        return "Response time has ended"
    }

    const hours = Math.floor(remaining / HOUR)
    const minutes = Math.floor((remaining % HOUR) / 60_000)
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (days > 0) {
        return `${days}d ${remainingHours}h left to reply`
    }

    return hours > 0 ? `${hours}h ${minutes}m left to reply` : `${minutes}m left to reply`
}

// A live view of the backend's 72-hour seller response deadline.
function DisputeCountdown({ deadline }: { deadline: string }) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000)
        return () => window.clearInterval(timer)
    }, [])

    return <span aria-live="off">{remainingLabel(deadline, now)}</span>
}

export default DisputeCountdown
