// Checks a chosen image before it is uploaded to Cloudinary, so a shopper-facing page never ends up
// with a file the browser cannot show, or one far too large for a phone connection.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

function formatMegabytes(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Returns a message for the shopper or seller, or null when the file is fine.
export function validateImageFile(file: File): string | null {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        return "Please choose a JPG, PNG, WebP or GIF image."
    }

    if (file.size > MAX_IMAGE_BYTES) {
        return `That image is ${formatMegabytes(file.size)}. Please choose one under ${formatMegabytes(MAX_IMAGE_BYTES)}.`
    }

    return null
}
