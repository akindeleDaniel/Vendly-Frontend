import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { AdminListHead } from "../components/AdminList"
import Notice from "../components/Notice"
import { avatarTone, initialsOf } from "../lib/adminDisplay"
import { failureMessage } from "../lib/apiRequest"
import type { ApiResult } from "../lib/apiRequest"
import { formatShortDate } from "../lib/orderApi"
import { addAdmin, fetchTeam, revokeAdmin, setSuperAdmin } from "../lib/platformApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { TeamMember } from "../types/platform"

type TeamResult = ApiResult<{ team: TeamMember[] }>
type Problem = Exclude<TeamResult, { kind: "ok" }>

// Turns a failed result into the words to show. An account with no password (for example one made with
// Google) cannot confirm a change, so it is sent to set one.
function ProblemNotice({ result }: { result: Problem }) {
    if (result.kind === "failed" && result.code === "ADMIN_PASSWORD_REQUIRED") {
        return (
            <Notice kind="warning">
                <p>Your account has no password yet, and changing the team needs one to confirm it is you.</p>
                <Link to="/change-password" className="btn">Set a password</Link>
            </Notice>
        )
    }

    return <Notice kind="error">{failureMessage(result)}</Notice>
}

type MemberRowProps = {
    member: TeamMember
    onTeam: (team: TeamMember[]) => void
}

// One administrator, with removing them or giving or taking away the super level. Each change asks
// for your own password, on the row itself.
function MemberRow({ member, onTeam }: MemberRowProps) {
    const passwordId = useId()
    const [action, setAction] = useState<"revoke" | "super" | null>(null)
    const [password, setPassword] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [problem, setProblem] = useState<Problem | null>(null)
    const [localError, setLocalError] = useState("")

    function cancel() {
        setAction(null)
        setPassword("")
        setProblem(null)
        setLocalError("")
    }

    async function confirm(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isWorking || action === null) {
            return
        }

        if (password === "") {
            setLocalError("Enter your own password to confirm.")
            return
        }

        setIsWorking(true)
        setProblem(null)
        setLocalError("")
        const result = action === "revoke"
            ? await revokeAdmin(member.id, password)
            : await setSuperAdmin(member.id, !member.isSuperAdmin, password)
        setIsWorking(false)

        if (result.kind === "ok") {
            cancel()
            onTeam(result.data.team)
        } else if (result.kind !== "unauthorized") {
            setProblem(result)
        }
    }

    const sentence = action === "revoke"
        ? `${member.name} loses the admin area straight away and is emailed.`
        : member.isSuperAdmin
            ? `${member.name} keeps the admin area but loses the platform figures, the team and the audit log. They are emailed.`
            : `${member.name} will see the platform figures, the team and the audit log, and can change the team. They are emailed.`

    return (
        <li className="admin-row admin-team-row">
            <span className={`admin-avatar ${avatarTone(member.id)}`} aria-hidden="true">{initialsOf(member.name)}</span>
            <div className="admin-cell">
                <span className="admin-tags">
                    <Link to={`/admin/users/${member.id}`} className="admin-plain-link"><b>{member.name}</b></Link>
                    <span className={`admin-tag${member.isSuperAdmin ? " is-admin" : " is-seller"}`}>{member.isSuperAdmin ? "Super administrator" : "Administrator"}</span>
                </span>
                <small>{member.email} · Joined {formatShortDate(member.createdAt)}</small>

                {action !== null && (
                    <form onSubmit={confirm} className="admin-confirm admin-team-confirm">
                        <p>{sentence}</p>
                        <div className="product-field">
                            <label htmlFor={passwordId}>Your password, to confirm it's you</label>
                            <input id={passwordId} className="product-input" type="password" autoComplete="current-password" value={password} disabled={isWorking} onChange={(event) => setPassword(event.target.value)} />
                        </div>
                        {localError && <Notice kind="error">{localError}</Notice>}
                        {problem && <ProblemNotice result={problem} />}
                        <div className="admin-actions-row">
                            <button type="submit" className={action === "revoke" ? "btn btn-danger" : "btn btn-primary"} disabled={isWorking}>
                                {isWorking ? "Working..." : action === "revoke" ? "Remove administrator" : "Confirm"}
                            </button>
                            <button type="button" className="btn" onClick={cancel} disabled={isWorking}>Cancel</button>
                        </div>
                    </form>
                )}
            </div>
            {action === null && (
                <div className="admin-team-actions">
                    <button type="button" className="btn-text" onClick={() => setAction("super")}>{member.isSuperAdmin ? "Remove super level" : "Make super administrator"}</button>
                    <button type="button" className="btn-text admin-danger-text" onClick={() => setAction("revoke")}>Remove</button>
                </div>
            )}
        </li>
    )
}

function AddAdminForm({ onTeam, onClose }: { onTeam: (team: TeamMember[]) => void, onClose: () => void }) {
    const id = useId()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [superAdmin, setSuper] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [problem, setProblem] = useState<Problem | null>(null)
    const [localError, setLocalError] = useState("")
    const [added, setAdded] = useState("")

    async function handleAdd(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isAdding) {
            return
        }

        if (email.trim() === "" || password === "") {
            setLocalError("Enter the person's email and your own password.")
            return
        }

        setIsAdding(true)
        setProblem(null)
        setLocalError("")
        setAdded("")
        const result = await addAdmin(email.trim(), password, superAdmin)
        setIsAdding(false)

        if (result.kind === "ok") {
            onTeam(result.data.team)
            setAdded(`${email.trim()} is now ${superAdmin ? "a super administrator" : "an administrator"}. They have been emailed, and need an emailed code each time they log in.`)
            setEmail("")
            setPassword("")
            setSuper(false)
        } else if (result.kind !== "unauthorized") {
            setProblem(result)
        }
    }

    return (
        <section className="money-card" aria-labelledby={`${id}-title`}>
            <div className="admin-card-top">
                <div className="admin-card-title">
                    <h2 id={`${id}-title`}>Add an administrator</h2>
                    <p>They need an account already, with a confirmed email. Like every administrator, they enter an emailed code each time they log in.</p>
                </div>
                <button type="button" className="btn-text" onClick={onClose}>Close</button>
            </div>
            {added && <Notice kind="success">{added}</Notice>}
            <form onSubmit={handleAdd} className="admin-form">
                <div className="product-two">
                    <div className="product-field">
                        <label htmlFor={`${id}-email`}>Their email</label>
                        <input id={`${id}-email`} className="product-input" type="email" autoComplete="off" value={email} disabled={isAdding} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                    <div className="product-field">
                        <label htmlFor={`${id}-password`}>Your password, to confirm it's you</label>
                        <input id={`${id}-password`} className="product-input" type="password" autoComplete="current-password" value={password} disabled={isAdding} onChange={(event) => setPassword(event.target.value)} />
                    </div>
                </div>
                <label className="settings-check">
                    <input type="checkbox" checked={superAdmin} disabled={isAdding} onChange={(event) => setSuper(event.target.checked)} />
                    <span>Make them a super administrator</span>
                </label>
                {localError && <Notice kind="error">{localError}</Notice>}
                {problem && <ProblemNotice result={problem} />}
                <div className="admin-actions-row">
                    <button type="submit" className="btn btn-primary" disabled={isAdding}>{isAdding ? "Adding..." : "Add administrator"}</button>
                    <button type="button" className="btn" disabled={isAdding} onClick={onClose}>Cancel</button>
                </div>
            </form>
        </section>
    )
}

// The administrators, for super administrators: who they are, adding someone, and removing or promoting
// them. Every change asks for your own password and emails the person it affects.
function AdminTeamPage() {
    useDocumentTitle("Team")
    const { state, setData, reload } = useApiResource("team", (signal) => fetchTeam(signal))
    const [isAdding, setIsAdding] = useState(false)

    function showTeam(team: TeamMember[]) {
        setData(() => ({ team }))
    }

    return (
        <div className="admin-page">
            <AdminListHead
                title="Team"
                intro="Everyone who can use the admin area. Super administrators also see the platform figures, this team and the audit log."
                action={!isAdding && (
                    <button type="button" className="btn btn-primary" onClick={() => setIsAdding(true)}>
                        <Plus size={16} aria-hidden="true" />Add an administrator
                    </button>
                )}
            />

            {isAdding && <AddAdminForm onTeam={showTeam} onClose={() => setIsAdding(false)} />}

            {state.kind === "loading" && <p role="status">Loading the team...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <div className="admin-panel">
                    <ul className="admin-rows">
                        {state.data.team.map((member) => <MemberRow key={member.id} member={member} onTeam={showTeam} />)}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default AdminTeamPage
