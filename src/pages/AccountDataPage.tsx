import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check, ChevronRight, CircleAlert, Download, Lock, Trash2, X } from "lucide-react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import { deleteMyAccount, downloadMyData, fetchDeletionCheck, readBlockers } from "../lib/accountDataApi"
import type { DeletionBlocker } from "../lib/accountDataApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { UserRole } from "../types/user"

type AccountDataPageProps = {
    // False for an account made with Google that has not set a password: deleting asks for one.
    hasPassword: boolean
    userRole: UserRole | null
    // Called once the account is gone, so the app forgets the login.
    onDeleted: () => void
}

// Where each reason the account cannot be deleted yet is sorted out. A reason with no page has no link.
function blockerLink(code: string, isSeller: boolean): { to: string, label: string } | null {
    switch (code) {
        case "ORDERS_ON_THE_WAY":
        case "REFUNDS_RUNNING":
        case "PAYMENT_IN_PROGRESS":
            return { to: "/orders", label: "My orders" }
        case "COMPLAINTS_OPEN":
            return { to: isSeller ? "/seller/disputes" : "/disputes", label: "Complaints" }
        case "ORDERS_TO_FULFIL":
            return { to: "/seller/orders", label: "Shop orders" }
        case "MONEY_OWED":
            return { to: "/seller/earnings?tab=money", label: "Money" }
        default:
            return null
    }
}

// "Your data and account": download a copy of everything StoreHatch holds about you, or delete the account.
// The backend decides whether the account can be deleted and checks the password; this page only explains.
function AccountDataPage({ hasPassword, userRole, onDeleted }: AccountDataPageProps) {
    useDocumentTitle("Your data and account")
    const navigate = useNavigate()
    const isSeller = userRole === "SELLER"
    const { state, reload, setData } = useApiResource("deletion-check", (signal) => fetchDeletionCheck(signal))

    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadError, setDownloadError] = useState("")
    const [hasDownloaded, setHasDownloaded] = useState(false)

    const [isConfirming, setIsConfirming] = useState(false)
    const [password, setPassword] = useState("")
    const [understood, setUnderstood] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [passwordError, setPasswordError] = useState("")
    const [deleteError, setDeleteError] = useState("")
    const [needsPassword, setNeedsPassword] = useState(!hasPassword)

    async function handleDownload() {
        setIsDownloading(true)
        setDownloadError("")
        const problem = await downloadMyData()
        setIsDownloading(false)

        if (problem) {
            setDownloadError(problem)
        } else {
            setHasDownloaded(true)
        }
    }

    function cancelDelete() {
        setIsConfirming(false)
        setPassword("")
        setUnderstood(false)
        setPasswordError("")
        setDeleteError("")
    }

    async function handleDelete(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isDeleting || !understood || password === "") {
            return
        }

        setIsDeleting(true)
        setPasswordError("")
        setDeleteError("")
        const result = await deleteMyAccount(password)
        setIsDeleting(false)

        if (result.kind === "ok") {
            // The done page is open to everyone, so it still shows once the app forgets the login.
            navigate("/account/deleted", { replace: true })
            onDeleted()
            return
        }

        if (result.kind === "unauthorized") {
            return
        }

        if (result.kind === "failed" && result.code === "ACCOUNT_HAS_OPEN_ITEMS") {
            // Something started since the page checked, for example a new order.
            setData(() => ({ canDelete: false, blockers: readBlockers(result.body) }))
            cancelDelete()
            return
        }

        if (result.kind === "failed" && result.code === "PASSWORD_REQUIRED") {
            setNeedsPassword(true)
            cancelDelete()
            return
        }

        if (result.kind === "failed" && result.status === 400) {
            setPasswordError(result.message || "Your password is not right.")
            return
        }

        setDeleteError(failureMessage(result))
    }

    function renderBlockers(blockers: DeletionBlocker[]) {
        return (
            <>
                <div className="account-status is-waiting" role="status">
                    <b><CircleAlert size={18} aria-hidden="true" />Finish these first, then come back</b>
                    <ul className="account-blockers">
                        {blockers.map((blocker) => {
                            const link = blockerLink(blocker.code, isSeller)
                            return (
                                <li key={blocker.code}>
                                    <span>{blocker.message.endsWith(".") ? blocker.message : `${blocker.message}.`}</span>
                                    {link && <Link to={link.to}>{link.label}<ChevronRight size={16} aria-hidden="true" /></Link>}
                                </li>
                            )
                        })}
                    </ul>
                </div>
                <div className="account-actions">
                    <button type="button" className="btn" onClick={reload}>Check again</button>
                    <span className="account-small">Your data download above still works meanwhile.</span>
                </div>
            </>
        )
    }

    function renderDeleteState() {
        if (needsPassword) {
            return (
                <>
                    <div className="account-status is-info" role="status">
                        <b><Lock size={18} aria-hidden="true" />Set a password first</b>
                        <span>You signed up with Google. Deleting asks for your password to make sure it's really you, so add one, then come back here.</span>
                    </div>
                    <div className="account-actions">
                        <Link to="/change-password" className="btn btn-primary">Set a password</Link>
                    </div>
                </>
            )
        }

        if (state.kind === "loading") {
            return <p role="status" className="account-small">Checking whether your account can be deleted...</p>
        }

        if (state.kind === "error") {
            return (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )
        }

        if (!state.data.canDelete) {
            return renderBlockers(state.data.blockers)
        }

        if (!isConfirming) {
            return (
                <>
                    <div className="account-status is-ok" role="status">
                        <Check size={18} aria-hidden="true" />Nothing is waiting on you, so your account can be deleted.
                    </div>
                    <div className="account-actions">
                        <button type="button" className="btn btn-danger" onClick={() => setIsConfirming(true)}>Delete my account</button>
                    </div>
                </>
            )
        }

        return (
            <form className="account-confirm" aria-labelledby="account-confirm-title" onSubmit={handleDelete} noValidate>
                <h3 id="account-confirm-title">Enter your password to delete your account</h3>
                <label htmlFor="account-delete-password">
                    Your password
                    <input
                        id="account-delete-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => { setPassword(event.target.value); setPasswordError("") }}
                        aria-invalid={passwordError ? true : undefined}
                        aria-describedby={passwordError ? "account-delete-password-error" : undefined}
                        autoFocus
                    />
                </label>
                {passwordError && <p id="account-delete-password-error" className="field-error" role="alert">{passwordError}</p>}
                <label className="account-check">
                    <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
                    I understand my account can't be brought back.
                </label>
                {deleteError && <Notice kind="error">{deleteError}</Notice>}
                <div className="account-actions">
                    <button type="submit" className="btn btn-danger" disabled={isDeleting || !understood || password === ""}>
                        {isDeleting ? "Deleting..." : "Delete my account for good"}
                    </button>
                    <button type="button" className="btn" onClick={cancelDelete} disabled={isDeleting}>Keep my account</button>
                </div>
            </form>
        )
    }

    return (
        <div className="account-page">
            <div className="account-title">
                <BackArrow to={isSeller ? "/seller/myListing" : "/orders"} label="Back" />
                <h1>Your data and account</h1>
            </div>
            <p className="account-lead">See what StoreHatch keeps about you, take a copy, or close your account.</p>

            <section className="account-card" aria-labelledby="account-download-title">
                <div className="account-card-head">
                    <span className="account-icon" aria-hidden="true"><Download size={20} /></span>
                    <div>
                        <h2 id="account-download-title">Download your data</h2>
                        <p>
                            One file with everything StoreHatch holds about you: your account, orders, reviews, complaints, pre-orders,
                            cart and the devices you stay logged in on. If you sell, it also has your shop, products and sales. It never
                            contains your password.
                        </p>
                    </div>
                </div>
                <div className="account-actions">
                    <button type="button" className="btn" onClick={handleDownload} disabled={isDownloading}>
                        <Download size={18} aria-hidden="true" />
                        {isDownloading ? "Preparing..." : hasDownloaded ? "Download again" : "Download my data"}
                    </button>
                    <span className="account-small">A .json file. It opens in any text editor.</span>
                </div>
                {downloadError && <Notice kind="error">{downloadError}</Notice>}
            </section>

            <section className="account-card" aria-labelledby="account-delete-title">
                <div className="account-card-head">
                    <span className="account-icon is-danger" aria-hidden="true"><Trash2 size={20} /></span>
                    <div>
                        <h2 id="account-delete-title">Delete your account</h2>
                        <p>You'll be logged out everywhere and can't undo it. You can sign up again later with the same email, as a new account.</p>
                    </div>
                </div>
                <div className="account-lists">
                    <div className="account-list">
                        <h3><X size={16} aria-hidden="true" className="is-removed" />Removed</h3>
                        <ul>
                            <li>Your name, email and password</li>
                            <li>Delivery names, phones and addresses on your orders</li>
                            <li>Your cart, saved devices and open pre-order requests</li>
                            <li>If you sell: your shop closes and every product goes off sale</li>
                        </ul>
                    </div>
                    <div className="account-list">
                        <h3><Check size={16} aria-hidden="true" className="is-kept" />Kept, without your name</h3>
                        <ul>
                            <li>Orders and payments, which sellers and StoreHatch must keep</li>
                            <li>Complaints and refunds</li>
                            <li>Your reviews, shown as “A former buyer”</li>
                        </ul>
                    </div>
                </div>
                {renderDeleteState()}
            </section>
        </div>
    )
}

export default AccountDataPage
