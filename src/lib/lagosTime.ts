// StoreHatch runs on Nigerian time: days, deadlines and ready times are shown in Africa/Lagos (UTC+1 all
// year, no summer time), whatever time zone the phone or computer is set to. The backend counts days the same way.
export const LAGOS_TIME_ZONE = "Africa/Lagos"

const partsFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
})

// The calendar day and clock time in Nigeria at a moment (month 1 to 12).
export function lagosParts(date: Date = new Date()): { year: number, month: number, day: number, hour: number, minute: number } {
    const parts = Object.fromEntries(partsFormat.formatToParts(date).map((part) => [part.type, part.value]))
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) }
}

const pad = (value: number) => String(value).padStart(2, "0")

// "2026-10-28": the Nigerian calendar day of a moment (today by default).
export function lagosDay(date: Date = new Date()): string {
    const { year, month, day } = lagosParts(date)
    return `${year}-${pad(month)}-${pad(day)}`
}

// "2026-10-28" for any year, month (0-based, may overflow) and day (may overflow), as a plain calendar day.
export function calendarDay(year: number, monthIndex: number, day: number): string {
    return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10)
}

// The value a datetime-local box wants ("2026-11-02T14:00") for a moment, in Nigerian time.
export function lagosInputValue(date: Date): string {
    const { year, month, day, hour, minute } = lagosParts(date)
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}

// The moment a datetime-local value ("2026-11-02T14:00") means when it is read as Nigerian time.
export function fromLagosInput(value: string): Date {
    return new Date(`${value}:00+01:00`)
}
