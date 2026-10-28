import { useState } from "react"
import { Link } from "react-router-dom"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import type { ApiResult } from "../lib/apiRequest"
import { formatShortDate } from "../lib/orderApi"
import { addAdmin, fetchTeam, revokeAdmin, setSuperAdmin } from "../lib/platformApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { TeamMember } from "../types/platform"

type TeamResult = ApiResult<{ team: TeamMember[] }>

// Turns a failed result into the words to show. An account with no password (for example one made with
// Google) cannot confirm a change, so it is sent to set one.
function ProblemNotice({ result }: { result: Exclude<TeamResult, { kind: "ok" }> }) {
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

type MemberActionsProps = {
    member: TeamMember
    onTeam: (team: TeamMember[]) => void
}

// Remove a person, or give or take away the super level. Each one asks for your own password.
function MemberActions({ member, onTeam }: MemberActionsProps) {
    const [action, setAction] = useState<"revoke" | "super" | null>(null)
    const [password, setPassword] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [problem, setProblem] = useState<Exclude<TeamResult, { kind: "ok" }> | null>(null)
    const [localError, setLocalError] = useState("")

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
            setAction(null)
            setPassword("")
            onTeam(result.data.team)
        } else if (result.kind !== "unauthorized") {
            setProblem(result)
        }
    }

    if (action === null) {
        return (
            <div className="action-row">
                <button type="button" onClick={() => setAction("super")}>{member.isSuperAdmin ? "Remove super level" : "Make super administrator"}</button>
                <button type="button" onClick={() => setAction("revoke")}>Remove administrator</button>
            </div>
        )
    }

    const sentence = action === "revoke"
        ? `Remove ${member.name} as an administrator? They lose all administrator access straight away and are emailed.`
        : member.isSuperAdmin
            ? `Take away ${member.name}'s super level? They stay an administrator and are emailed.`
            : `Make ${member.name} a super administrator? They will see the platform figures, the team and the audit log, and can change the team.`

    return (
        <form onSubmit={confirm} className="stack-form">
            <Notice kind="warning">{sentence}</Notice>
            <label>
                Your password, to confirm it is you
                <input type="password" autoComplete="current-password" value={password} disabled={isWorking} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {localError && <Notice kind="error">{localError}</Notice>}
            {problem && <ProblemNotice result={problem} />}
            <div className="action-row">
                <button type="submit" className={action === "revoke" ? "btn btn-danger" : "btn btn-primary"} disabled={isWorking}>{isWorking ? "Working..." : "Confirm"}</button>
                <button type="button" onClick={() => { setAction(null); setPassword(""); setProblem(null); setLocalError("") }} disabled={isWorking}>Cancel</button>
            </div>
        </form>
    )
}

// The administrators, for super administrators: who they are, adding someone, and removing or promoting
// them. Every change asks for your own password and emails the person it affects.
function AdminTeamPage() {
    useDocumentTitle("Team")
    const { state, setData, reload } = useApiResource("team", (signal) => fetchTeam(signal))
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [superAdmin, setSuper] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [problem, setProblem] = useState<Exclude<TeamResult, { kind: "ok" }> | null>(null)
    const [localError, setLocalError] = useState("")
    const [added, setAdded] = useState("")

    function showTeam(team: TeamMember[]) {
        setData(() => ({ team }))
    }

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
            showTeam(result.data.team)
            setAdded(`${email.trim()} is now ${superAdmin ? "a super administrator" : "an administrator"}. They have been emailed, and need an emailed code each time they log in.`)
            setEmail("")
            setPassword("")
            setSuper(false)
        } else if (result.kind !== "unauthorized") {
            setProblem(result)
        }
    }

    return (
        <div>
            <h1>Team</h1>

            {state.kind === "loading" && <p role="status">Loading the team...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    <ul className="order-history">
                        {state.data.team.map((member) => (
                            <li key={member.id} className="card order-card">
                                <div className="order-header">
                                    <h2><Link to={`/admin/users/${member.id}`}>{member.name}</Link></h2>
                                    <span className="badge">{member.isSuperAdmin ? "Super administrator" : "Administrator"}</span>
                                </div>
                                <p className="order-line-meta">{member.email} · joined {formatShortDate(member.createdAt)}</p>
                                <MemberActions member={member} onTeam={showTeam} />
                            </li>
                        ))}
                    </ul>

                    <section aria-labelledby="add-admin-heading" className="card summary-card">
                        <h2 id="add-admin-heading">Add an administrator</h2>
                        <p className="field-help">The person needs an account already, with a confirmed email. They are emailed, and like every administrator they enter an emailed code each time they log in.</p>
                        {added && <Notice kind="success">{added}</Notice>}
                        <form onSubmit={handleAdd} className="stack-form">
                            <label>
                                Their email
                                <input type="email" autoComplete="off" value={email} disabled={isAdding} onChange={(event) => setEmail(event.target.value)} />
                            </label>
                            <label className="checkbox-label">
                                <input type="checkbox" checked={superAdmin} disabled={isAdding} onChange={(event) => setSuper(event.target.checked)} />
                                Make them a super administrator
                            </label>
                            <label>
                                Your password, to confirm it is you
                                <input type="password" autoComplete="current-password" value={password} disabled={isAdding} onChange={(event) => setPassword(event.target.value)} />
                            </label>
                            {localError && <Notice kind="error">{localError}</Notice>}
                            {problem && <ProblemNotice result={problem} />}
                            <button type="submit" className="btn btn-primary" disabled={isAdding}>{isAdding ? "Adding..." : "Add administrator"}</button>
                        </form>
                    </section>
                </>
            )}
        </div>
    )
}

export default AdminTeamPage
