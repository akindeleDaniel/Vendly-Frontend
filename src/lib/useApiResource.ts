import { useEffect, useRef, useState } from "react"
import { failureMessage } from "./apiRequest"
import type { ApiResult } from "./apiRequest"

export type ResourceState<T> =
    | { kind: "loading" }
    | { kind: "ready", data: T }
    | { kind: "error", message: string }

// Loads something from the backend when the page opens and again when `key` changes (for example a
// filter or page number). `reload` tries again after an error; `setData` changes what is shown after
// an action, so one row can update without reloading the whole list.
export function useApiResource<T>(key: string, load: (signal: AbortSignal) => Promise<ApiResult<T>>) {
    const loadRef = useRef(load)
    const [result, setResult] = useState<{ token: string, state: ResourceState<T> } | null>(null)
    const [attempt, setAttempt] = useState(0)
    const token = `${key}#${attempt}`

    useEffect(() => {
        loadRef.current = load
    })

    useEffect(() => {
        const controller = new AbortController()

        loadRef.current(controller.signal).then((outcome) => {
            if (controller.signal.aborted) {
                return
            }

            if (outcome.kind === "ok") {
                setResult({ token, state: { kind: "ready", data: outcome.data } })
            } else if (outcome.kind !== "unauthorized") {
                setResult({ token, state: { kind: "error", message: failureMessage(outcome) } })
            }// on a 401 the session guard sends the person to log in
        })

        return () => controller.abort()
    }, [token])

    const state: ResourceState<T> = result !== null && result.token === token ? result.state : { kind: "loading" }

    function setData(change: (data: T) => T) {
        setResult((current) => current !== null && current.state.kind === "ready"
            ? { token: current.token, state: { kind: "ready", data: change(current.state.data) } }
            : current)
    }

    return { state, setData, reload: () => setAttempt((count) => count + 1) }
}
