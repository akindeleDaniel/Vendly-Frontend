export const MESSAGE_MIN_LENGTH = 10
export const MESSAGE_MAX_LENGTH = 2000

// A message must be 10 to 2000 characters. Returns what is wrong with it, or null.
export function validateMessage(text: string, what = "message"): string | null {
    const length = text.trim().length

    if (length < MESSAGE_MIN_LENGTH) {
        return `Your ${what} must be at least ${MESSAGE_MIN_LENGTH} characters.`
    }

    if (length > MESSAGE_MAX_LENGTH) {
        return `Your ${what} must be at most ${MESSAGE_MAX_LENGTH} characters.`
    }

    return null
}
