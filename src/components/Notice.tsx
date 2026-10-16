import type { ReactNode, Ref } from "react"

type NoticeKind = "error" | "warning" | "success" | "info"

type NoticeProps = {
    kind: NoticeKind
    children: ReactNode
    // Errors and warnings interrupt (alert); success and info are announced politely (status).
    // "none" leaves the role off, for a message that is simply part of the page.
    role?: "alert" | "status" | "none"
    id?: string
    tabIndex?: number
    ref?: Ref<HTMLDivElement>
}

function NoticeIcon({ kind }: { kind: NoticeKind }) {
    const common = {
        width: 20,
        height: 20,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
        focusable: false
    }

    if (kind === "warning") {
        return (
            <svg {...common}>
                <path d="M12 3 2.5 20h19L12 3z" />
                <line x1="12" y1="10" x2="12" y2="14" />
                <line x1="12" y1="17" x2="12" y2="17.1" />
            </svg>
        )
    }

    if (kind === "success") {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="9" />
                <polyline points="8,12.5 11,15.5 16,9" />
            </svg>
        )
    }

    if (kind === "info") {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="11" x2="12" y2="16" />
                <line x1="12" y1="8" x2="12" y2="8.1" />
            </svg>
        )
    }

    return (
        <svg {...common}>
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="7" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12" y2="16.6" />
        </svg>
    )
}

// A message box with an icon and words, so colour is never the only signal.
function Notice({ kind, children, role, id, tabIndex, ref }: NoticeProps) {
    const resolvedRole = role ?? (kind === "error" || kind === "warning" ? "alert" : "status")

    return (
        <div
            ref={ref}
            id={id}
            tabIndex={tabIndex}
            role={resolvedRole === "none" ? undefined : resolvedRole}
            className={`alert alert-${kind} alert-row`}
        >
            <NoticeIcon kind={kind} />
            <div className="alert-body">{children}</div>
        </div>
    )
}

export default Notice
