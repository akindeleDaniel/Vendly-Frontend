import { Check, CloudUpload, TriangleAlert } from "lucide-react"
import type { BackgroundUploadState } from "../lib/useBackgroundUpload"
import { uploadFailureMessage } from "../lib/uploadImage"

type UploadStatusProps = {
    state: BackgroundUploadState
    thing: string // what is being uploaded, for example "logo"
    onRetry: () => void
}

// One line under an image picker saying how its background upload is going.
function UploadStatus({ state, thing, onRetry }: UploadStatusProps) {
    if (state.status === "idle") {
        return null
    }

    return (
        <div className={`upload-status is-${state.status}`} role="status">
            {state.status === "uploading" && <><CloudUpload size={16} aria-hidden="true" />Uploading the {thing}…</>}
            {state.status === "done" && <><Check size={16} aria-hidden="true" />{thing.charAt(0).toUpperCase() + thing.slice(1)} uploaded</>}
            {state.status === "failed" && (
                <>
                    <TriangleAlert size={16} aria-hidden="true" />
                    <span>{uploadFailureMessage(state.reason, thing)}</span>
                    <button type="button" className="btn" onClick={onRetry}>Try again</button>
                </>
            )}
        </div>
    )
}

export default UploadStatus
