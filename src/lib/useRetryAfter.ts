import { useEffect, useState } from "react"

const LONGEST_WAIT_SECONDS = 15 * 60

// Locks a form's submit button for a while after the backend answers "too many attempts" (429).
// `block` takes the number of seconds to wait; `remaining` counts down to 0 and the button label
// can show it.
export function useRetryAfter() {
    const [remaining, setRemaining] = useState(0)

    useEffect(() => {
        if (remaining <= 0) {
            return
        }

        const timer = window.setTimeout(() => setRemaining((seconds) => seconds - 1), 1000)
        return () => window.clearTimeout(timer)
    }, [remaining])

    return {
        remaining,
        block: (seconds: number | undefined) => {
            if (seconds !== undefined && seconds > 0) {
                setRemaining(Math.min(Math.ceil(seconds), LONGEST_WAIT_SECONDS))
            }
        }
    }
}
