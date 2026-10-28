const JPEG_QUALITY = 0.82// as in the crop dialog: much smaller files, no visible difference

// Makes a phone photo smaller before it is uploaded, so it goes through on a slow connection: at most
// `maxSide` pixels on its longer side, saved as a JPEG. Small photos, and anything that cannot be
// read, are returned unchanged.
export async function shrinkImage(file: File, maxSide = 1600): Promise<File> {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
        return file
    }

    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))

        if (scale === 1 && file.size < 600_000) {
            bitmap.close()
            return file
        }

        const canvas = document.createElement("canvas")
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        const context = canvas.getContext("2d")

        if (!context) {
            bitmap.close()
            return file
        }

        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY))

        if (!blob || blob.size >= file.size) {
            return file
        }

        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })
    } catch {
        return file
    }
}
