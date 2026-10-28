import { useRef, useState } from "react"
import { uploadImageWithReason } from "./uploadImage"
import type { UploadFailure, UploadResult } from "./uploadImage"

export type BackgroundUploadState =
    | { status: "idle" }
    | { status: "uploading" }
    | { status: "done", url: string }
    | { status: "failed", reason: UploadFailure }

// Starts uploading an image as soon as it is picked, so it is usually finished by the time the form is
// saved. `urlFor` gives the saved form the address: it waits for an upload still running, and tries
// again when the last one failed. Picking another image, or none, forgets the earlier one.
export function useBackgroundUpload() {
    const [state, setState] = useState<BackgroundUploadState>({ status: "idle" })
    const pending = useRef<{ file: File, promise: Promise<UploadResult> } | null>(null)

    function begin(file: File): Promise<UploadResult> {
        const promise = uploadImageWithReason(file)
        pending.current = { file, promise }
        setState({ status: "uploading" })
        promise.then((result) => {
            if (pending.current?.file === file) {
                setState(result.ok ? { status: "done", url: result.url } : { status: "failed", reason: result.reason })
            }
        })
        return promise
    }

    function start(file: File | null) {
        if (file === null) {
            pending.current = null
            setState({ status: "idle" })
            return
        }
        void begin(file)
    }

    async function urlFor(file: File): Promise<UploadResult> {
        if (pending.current?.file === file) {
            const result = await pending.current.promise
            if (result.ok) {
                return result
            }
        }
        return begin(file)
    }

    function retry() {
        if (pending.current) {
            void begin(pending.current.file)
        }
    }

    return { state, start, urlFor, retry }
}
