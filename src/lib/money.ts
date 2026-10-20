// Display arithmetic for prices. Amounts are converted to whole minor units (hundredths) before
// they are multiplied or added, so totals do not pick up floating-point errors. These numbers are
// for display only; the authoritative amounts are calculated by the server at checkout.

export function toMinorUnits(amount: number): number {
    return Math.round(amount * 100)
}

// Formats whole minor units (kobo) as naira for display, for example 16963800 → "₦169,638.00".
export function formatMinorUnits(minorUnits: number): string {
    const sign = minorUnits < 0 ? "-" : ""
    const absolute = Math.abs(minorUnits)
    const whole = String(Math.trunc(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const hundredths = String(absolute % 100).padStart(2, "0")

    return `${sign}₦${whole}.${hundredths}`
}

// Formats an amount string from the server (for example "169638.00") as naira for display. The
// string is read digit by digit rather than through floating point. Anything that is not a plain
// amount is shown unchanged.
export function formatNaira(amount: string): string {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim())

    if (!match) {
        return amount
    }

    const [, sign, whole, fraction = ""] = match
    return formatMinorUnits(Number(`${sign}${whole}${fraction.padEnd(2, "0")}`))
}
