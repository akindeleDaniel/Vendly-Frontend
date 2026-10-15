// Display arithmetic for prices. Amounts are converted to whole minor units (hundredths) before
// they are multiplied or added, so totals do not pick up floating-point errors. These numbers are
// for display only; the authoritative amounts are calculated by the server at checkout.

export function toMinorUnits(amount: number): number {
    return Math.round(amount * 100)
}

// Formats whole minor units as a plain number with two decimals and no currency symbol.
export function formatMinorUnits(minorUnits: number): string {
    const sign = minorUnits < 0 ? "-" : ""
    const absolute = Math.abs(minorUnits)
    const whole = Math.trunc(absolute / 100)
    const hundredths = String(absolute % 100).padStart(2, "0")

    return `${sign}${whole}.${hundredths}`
}
