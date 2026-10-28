// Small helpers for the administrator lists.

// "Page 1 of 65" beside a list's count, when there is more than one page.
export function pageOf(page: number, pageSize: number, total: number): string {
    const pages = Math.ceil(total / pageSize)
    return pages > 1 ? `Page ${page} of ${pages}` : ""
}

// Up to two letters for a person's round picture: "Ada Okafor" becomes "AO".
export function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ""
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
    return (first + last).toUpperCase() || "?"
}

const AVATAR_TONES = ["is-forest", "is-amber", "is-clay", "is-stone"]

// The same person always gets the same colour.
export function avatarTone(id: number): string {
    return AVATAR_TONES[Math.abs(id) % AVATAR_TONES.length]
}
