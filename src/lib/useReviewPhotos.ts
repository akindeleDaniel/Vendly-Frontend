import { useEffect, useRef, useState } from "react"
import { shrinkImage } from "./shrinkImage"
import { uploadImageWithReason } from "./uploadImage"
import type { UploadFailure } from "./uploadImage"

export const REVIEW_PHOTO_LIMIT = 3// the backend takes up to 3

export type ReviewPhoto =
    | { key: string, preview: string, status: "uploading", file: File }
    | { key: string, preview: string, status: "done", url: string }
    | { key: string, preview: string, status: "failed", file: File, reason: UploadFailure }

let nextKey = 0

// The photos a buyer adds to their reviews, for each thing being reviewed (the shop, or one product).
// Each photo starts uploading as soon as it is picked, so it is usually done before the review is
// posted. Photos already on a saved review start as done. Photos are optional: none is fine.
export function useReviewPhotos(initial: Record<string, string[]> = {}) {
    const [photos, setPhotos] = useState<Record<string, ReviewPhoto[]>>(() => Object.fromEntries(
        Object.entries(initial).map(([target, urls]) => [target, urls.map((url) => ({ key: `saved-${nextKey++}`, preview: url, status: "done" as const, url }))])
    ))
    const previews = useRef<string[]>([])

    // Free the picked photos' previews when the form goes away.
    useEffect(() => {
        const made = previews.current
        return () => made.forEach((preview) => URL.revokeObjectURL(preview))
    }, [])

    function update(target: string, key: string, change: (photo: ReviewPhoto) => ReviewPhoto) {
        setPhotos((current) => ({ ...current, [target]: (current[target] ?? []).map((photo) => photo.key === key ? change(photo) : photo) }))
    }

    async function upload(target: string, key: string, file: File) {
        const result = await uploadImageWithReason(file)
        update(target, key, (photo) => photo.status === "uploading" && photo.file === file
            ? result.ok
                ? { key, preview: photo.preview, status: "done", url: result.url }
                : { key, preview: photo.preview, status: "failed", file, reason: result.reason }
            : photo)
    }

    // Adds picked files, as many as still fit. Returns how many were left out.
    async function add(target: string, files: File[]): Promise<number> {
        const room = REVIEW_PHOTO_LIMIT - (photos[target]?.length ?? 0)
        const chosen = files.filter((file) => file.type.startsWith("image/")).slice(0, Math.max(room, 0))
        const added: Array<{ key: string, file: File }> = []

        for (const original of chosen) {
            const file = await shrinkImage(original)
            const key = `new-${nextKey++}`
            const preview = URL.createObjectURL(file)
            previews.current.push(preview)
            added.push({ key, file })
            setPhotos((current) => ({ ...current, [target]: [...(current[target] ?? []), { key, preview, status: "uploading", file }] }))
        }

        added.forEach(({ key, file }) => void upload(target, key, file))
        return files.length - chosen.length
    }

    function remove(target: string, key: string) {
        setPhotos((current) => ({ ...current, [target]: (current[target] ?? []).filter((photo) => photo.key !== key) }))
    }

    function retry(target: string, key: string) {
        const photo = photos[target]?.find((item) => item.key === key)

        if (photo?.status === "failed") {
            update(target, key, () => ({ key, preview: photo.preview, status: "uploading", file: photo.file }))
            void upload(target, key, photo.file)
        }
    }

    // The uploaded addresses to send with a review.
    function urlsFor(target: string): string[] {
        return (photos[target] ?? []).flatMap((photo) => photo.status === "done" ? [photo.url] : [])
    }

    function countWhere(targets: string[], status: ReviewPhoto["status"]): number {
        return targets.reduce((sum, target) => sum + (photos[target] ?? []).filter((photo) => photo.status === status).length, 0)
    }

    function clear() {
        setPhotos({})
    }

    return { photos, add, remove, retry, urlsFor, countWhere, clear }
}

export type ReviewPhotos = ReturnType<typeof useReviewPhotos>
