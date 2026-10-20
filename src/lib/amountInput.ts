export type AmountInput =
    | { ok: true, value: string | undefined }// undefined: the field was left empty
    | { ok: false, message: string }

// Reads an optional naira amount typed by a person. The backend wants a positive number with at
// most two decimals and checks the maximum itself, so only the shape is checked here.
export function parseOptionalNaira(text: string): AmountInput {
    const trimmed = text.trim().replace(/,/g, "")

    if (trimmed === "") {
        return { ok: true, value: undefined }
    }

    if (!/^\d+(\.\d{1,2})?$/.test(trimmed) || Number(trimmed) <= 0) {
        return { ok: false, message: "Enter an amount in naira, greater than 0, with at most two decimal places." }
    }

    return { ok: true, value: trimmed }
}
