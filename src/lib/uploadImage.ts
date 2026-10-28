// Uploads an image to Cloudinary and returns its address. Connections can be slow or drop for a moment,
// so each try has a time limit and a failed try is repeated a couple of times before giving up.

const TRY_TIMEOUT_MS = 45_000
const RETRY_DELAYS_MS = [1_000, 3_000]// waits before the second and third tries

export type UploadFailure = "offline" | "failed" | "not-configured"

export type UploadResult =
    | { ok: true, url: string }
    | { ok: false, reason: UploadFailure }

type TryOutcome = { kind: "ok", url: string } | { kind: "retry" } | { kind: "stop" }

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false

async function tryOnce(endpoint: string, file: File, uploadPreset: string): Promise<TryOutcome> {
    const imageData = new FormData()
    imageData.append("file", file)
    imageData.append("upload_preset", uploadPreset)

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TRY_TIMEOUT_MS)

    try {
        const response = await fetch(endpoint, { method: "POST", body: imageData, signal: controller.signal })
        const data = await response.json().catch(() => null)

        if (response.ok && typeof data?.secure_url === "string") {
            return { kind: "ok", url: data.secure_url }
        }

        // A busy or failing server may work a moment later; a rejected file will not.
        return response.status >= 500 || response.status === 429 ? { kind: "retry" } : { kind: "stop" }
    } catch {
        return { kind: "retry" }// the network dropped or the try took too long
    } finally {
        window.clearTimeout(timer)
    }
}

export async function uploadImageWithReason(file: File): Promise<UploadResult> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
        return { ok: false, reason: "not-configured" }
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
            await wait(RETRY_DELAYS_MS[attempt - 1])
        }

        if (isOffline()) {
            return { ok: false, reason: "offline" }
        }

        const outcome = await tryOnce(endpoint, file, uploadPreset)
        if (outcome.kind === "ok") {
            return { ok: true, url: outcome.url }
        }
        if (outcome.kind === "stop") {
            break
        }
    }

    return { ok: false, reason: isOffline() ? "offline" : "failed" }
}

// The same upload for callers that only need the address, or null when it failed.
export async function uploadImage(file: File): Promise<string | null> {
    const result = await uploadImageWithReason(file)
    return result.ok ? result.url : null
}

// What to tell the seller when an upload of `thing` (for example "logo") failed.
export function uploadFailureMessage(reason: UploadFailure, thing: string): string {
    switch (reason) {
        case "offline":
            return `You're offline, so the ${thing} couldn't be uploaded. Your details are kept, so try again when you're back online.`
        case "not-configured":
            return "Image uploads aren't available right now. Please try again later."
        default:
            return `The ${thing} couldn't be uploaded, even after trying again. Check your connection and try again. Your details are kept.`
    }
}
