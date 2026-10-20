import { useEffect, useState } from "react"

// A countdown in whole seconds, for buttons that must wait before they can be pressed again (for
// example "Send a new code"). It starts at `initialSeconds` and `restart` starts it over.
export function useCooldown(initialSeconds: number) {
    const [remaining, setRemaining] = useState(initialSeconds)

    useEffect(() => {
        if (remaining <= 0) {
            return
        }

        const timer = window.setTimeout(() => setRemaining((seconds) => seconds - 1), 1000)
        return () => window.clearTimeout(timer)
    }, [remaining])

    return { remaining, restart: () => setRemaining(initialSeconds) }
}
