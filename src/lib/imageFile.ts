// Checks a chosen image before it is uploaded to Cloudinary, so a shopper-facing page never ends up
// with a file the browser cannot show, or one far too large for a phone connection.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

function formatMegabytes(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// A product photo must be at least this many pixels across, so it stays sharp on the product page and
// when zoomed. The crop screen saves as many pixels as the chosen part of the photo has (up to 1000),
// so checking the cropped photo checks the part the seller picked.
export const MIN_PRODUCT_PHOTO_SIZE = 800

// The width and height of an image file, or null when the browser cannot read it.
export function readImageSize(file: File): Promise<{ width: number, height: number } | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file)
        const image = new Image()
        image.onload = () => {
            URL.revokeObjectURL(url)
            resolve({ width: image.naturalWidth, height: image.naturalHeight })
        }
        image.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(null)
        }
        image.src = url
    })
}

// Returns a message when a product photo is too small, or null when it is big enough. `afterCrop` changes
// the advice: a photo that was big enough before cropping only needs a larger part chosen.
export async function checkProductPhotoSize(file: File, afterCrop: boolean): Promise<string | null> {
    const size = await readImageSize(file)

    if (size === null || Math.min(size.width, size.height) >= MIN_PRODUCT_PHOTO_SIZE) {
        return null
    }

    const across = `${Math.min(size.width, size.height)} pixels`
    return afterCrop
        ? `The part you chose is only ${across} across. Zoom out to take in more of the photo, or choose a bigger one. Photos need at least ${MIN_PRODUCT_PHOTO_SIZE} × ${MIN_PRODUCT_PHOTO_SIZE} pixels to look sharp.`
        : `This photo is only ${across} across. Please choose one at least ${MIN_PRODUCT_PHOTO_SIZE} × ${MIN_PRODUCT_PHOTO_SIZE} pixels, so it looks sharp to shoppers.`
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
