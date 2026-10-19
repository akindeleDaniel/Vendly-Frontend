import { useEffect, useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import BankPicker from "../components/BankPicker"
import { ChevronLeftIcon } from "../components/Icons"
import Notice from "../components/Notice"
import {
    PROVIDER_NAMES,
    createPayoutAccounts,
    fetchPayoutBanks,
    fetchPayoutOverview,
    isAccountNumber,
    normalizeBusinessPhone,
    resolvePayoutAccount
} from "../lib/payoutApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { PayoutAccount, PayoutBank, PayoutOverview, PayoutStatus } from "../types/payout"

type LoadStatus = "loading" | "ready" | "error"

type ResolveState =
    | { key: string, kind: "found", accountName: string }
    | { key: string, kind: "invalid" }
    | { key: string, kind: "unavailable" }
    | { key: string, kind: "error", message: string }

const STATUS_LABELS: Record<PayoutStatus, string> = {
    ACTIVE: "Active",
    PENDING: "Setting up",
    FAILED: "Failed"
}

const STATUS_BADGE_CLASSES: Record<PayoutStatus, string> = {
    ACTIVE: "badge",
    PENDING: "badge badge-warning",
    FAILED: "badge badge-error"
}

function formatDate(value: string | null): string | null {
    if (!value) {
        return null
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
}

function isFullySetUp(accounts: PayoutAccount[]): boolean {
    return accounts.length > 0 && accounts.every((account) => account.status === "ACTIVE")
}

function ProviderStatusList({ accounts }: { accounts: PayoutAccount[] }) {
    return (
        <ul className="provider-list">
            {accounts.map((account) => (
                <li key={account.provider}>
                    <span className="provider-name">{PROVIDER_NAMES[account.provider]}</span>
                    <span className={STATUS_BADGE_CLASSES[account.status]}>{STATUS_LABELS[account.status]}</span>
                    {account.status === "FAILED" && account.failureReason && (
                        <span className="provider-reason">{account.failureReason}</span>
                    )}
                </li>
            ))}
        </ul>
    )
}

function PayoutSettingsPage() {
    const navigate = useNavigate()
    const termsId = useId()
    const phoneErrorId = useId()
    const accountStatusId = useId()
    useDocumentTitle("Payout settings")

    const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading")
    const [loadError, setLoadError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [banks, setBanks] = useState<PayoutBank[]>([])
    const [overview, setOverview] = useState<PayoutOverview | null>(null)

    const [bankId, setBankId] = useState("")
    const [accountNumber, setAccountNumber] = useState("")
    const [businessPhone, setBusinessPhone] = useState("")
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [resolveResult, setResolveResult] = useState<ResolveState | null>(null)
    const [resolveAttempt, setResolveAttempt] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState("")
    const [justSetUp, setJustSetUp] = useState(false)

    useEffect(() => {
        const controller = new AbortController()

        async function loadPage() {
            const [banksOutcome, overviewOutcome] = await Promise.all([
                fetchPayoutBanks(controller.signal),
                fetchPayoutOverview(controller.signal)
            ])

            if (controller.signal.aborted) {
                return
            }

            if (banksOutcome.kind === "unauthorized" || overviewOutcome.kind === "unauthorized") {
                return// the session guard sends the seller to log in
            }

            if (overviewOutcome.kind === "no-store") {
                navigate("/seller/onboarding", { replace: true })
                return
            }

            if (banksOutcome.kind !== "ok" || overviewOutcome.kind !== "ok") {
                setLoadError(
                    banksOutcome.kind === "error" ? banksOutcome.message
                        : overviewOutcome.kind === "error" ? overviewOutcome.message
                            : "We could not load your payout settings."
                )
                setLoadStatus("error")
                return
            }

            setBanks(banksOutcome.data)
            setOverview(overviewOutcome.data)

            // A retry has to use the bank that is already on file, so it starts selected.
            const savedBankId = overviewOutcome.data.accounts[0]?.bankId
            if (savedBankId && banksOutcome.data.some((bank) => bank.id === savedBankId)) {
                setBankId((current) => current || savedBankId)
            }
            setLoadStatus("ready")
        }

        loadPage().catch(() => {
            if (!controller.signal.aborted) {
                setLoadError("Something went wrong. Please check your connection and try again.")
                setLoadStatus("error")
            }
        })

        return () => controller.abort()
    }, [navigate, loadAttempt])

    // Looks up the account holder's name as soon as a bank and a full 10-digit number are entered.
    const resolveKey = bankId !== "" && isAccountNumber(accountNumber)
        ? `${bankId}:${accountNumber}:${resolveAttempt}`
        : null

    useEffect(() => {
        if (resolveKey === null) {
            return
        }

        const controller = new AbortController()

        resolvePayoutAccount(bankId, accountNumber, controller.signal).then((outcome) => {
            if (controller.signal.aborted || outcome.kind === "unauthorized") {
                return
            }

            if (outcome.kind === "found") {
                setResolveResult({ key: resolveKey, kind: "found", accountName: outcome.accountName })
            } else if (outcome.kind === "error") {
                setResolveResult({ key: resolveKey, kind: "error", message: outcome.message })
            } else {
                setResolveResult({ key: resolveKey, kind: outcome.kind })
            }
        })

        return () => controller.abort()
    }, [resolveKey, bankId, accountNumber])

    // A result only counts while it still matches what is typed in the form.
    const resolved = resolveResult !== null && resolveResult.key === resolveKey ? resolveResult : null
    const isChecking = resolveKey !== null && resolved === null

    const normalizedPhone = normalizeBusinessPhone(businessPhone)
    const phoneIsInvalid = businessPhone.trim() !== "" && normalizedPhone === null
    const canSubmit =
        resolved?.kind === "found" &&
        normalizedPhone !== null &&
        termsAccepted &&
        !isSubmitting

    async function refreshOverview() {
        const outcome = await fetchPayoutOverview()
        if (outcome.kind === "ok") {
            setOverview(outcome.data)
        }
    }

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!canSubmit || !overview || normalizedPhone === null) {
            return
        }

        setIsSubmitting(true)
        setSubmitError("")
        setJustSetUp(false)

        try {
            const outcome = await createPayoutAccounts({
                bankId,
                accountNumber,
                businessPhone: normalizedPhone,
                feeTermsVersion: overview.feeTerms.version
            })

            if (outcome.kind === "unauthorized") {
                return// the session guard sends the seller to log in
            }

            if (outcome.kind === "success") {
                setOverview((current) => current && { ...current, accounts: outcome.accounts, businessPhone: normalizedPhone })
                setAccountNumber("")
                setTermsAccepted(false)
                setJustSetUp(true)
                await refreshOverview()
                return
            }

            setSubmitError(outcome.message)

            if (outcome.kind === "incomplete") {
                setOverview((current) => current && { ...current, accounts: outcome.accounts })
            } else if (outcome.kind === "terms-outdated") {
                setTermsAccepted(false)// the seller must read the new wording
                await refreshOverview()
            } else if (outcome.kind === "already-active") {
                await refreshOverview()
            }
        } catch {
            setSubmitError("Something went wrong. Please check your connection and try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (loadStatus === "loading") {
        return <p role="status">Loading your payout settings...</p>
    }

    if (loadStatus === "error" || overview === null) {
        return (
            <div className="form-page-wide">
                <h1>Payout settings</h1>
                <Notice kind="error">
                    <p>{loadError || "We could not load your payout settings."} Please check your connection and try again.</p>
                    <button type="button" onClick={() => {
                        setLoadStatus("loading")
                        setLoadAttempt((attempt) => attempt + 1)
                    }}>Try again</button>
                </Notice>
            </div>
        )
    }

    const accounts = overview.accounts
    const isSetUp = isFullySetUp(accounts)
    const activeAccount = accounts.find((account) => account.status === "ACTIVE")
    const unfinishedAccounts = accounts.filter((account) => account.status !== "ACTIVE")
    const acceptedOn = formatDate(overview.feeTermsAcceptedAt)

    return (
        <div className="form-page-wide">
            <p className="page-back">
                <Link to="/seller/myListing" className="back-link">
                    <ChevronLeftIcon /> Back to my store
                </Link>
            </p>
            <h1>Payout settings</h1>
            <p className="page-intro">
                This is the bank account your sales are paid into. Vendly never asks for your bank login, PIN, OTP or BVN.
            </p>

            {justSetUp && (
                <Notice kind="success">Your payout account is set up. You can now receive payments for your sales.</Notice>
            )}

            {isSetUp && activeAccount ? (
                <section aria-labelledby="payout-account-heading" className="card form-card">
                    <h2 id="payout-account-heading">Your payout account</h2>
                    <dl className="detail-list">
                        <div><dt>Bank</dt><dd>{activeAccount.bankName}</dd></div>
                        <div><dt>Account name</dt><dd>{activeAccount.accountName}</dd></div>
                        <div><dt>Account number</dt><dd>
                            <span aria-hidden="true">&bull;&bull;&bull;&bull;&bull;&bull; {activeAccount.accountNumberLast4}</span>
                            <span className="visually-hidden">ending in {activeAccount.accountNumberLast4}</span>
                        </dd></div>
                        {overview.businessPhone && <div><dt>Business phone</dt><dd>{overview.businessPhone}</dd></div>}
                        {acceptedOn && <div><dt>Fee terms accepted</dt><dd>{acceptedOn}</dd></div>}
                    </dl>

                    <h3>Payment providers</h3>
                    <ProviderStatusList accounts={accounts} />

                    <details className="terms-details">
                        <summary>Payout fee terms</summary>
                        <p className="terms-text">{overview.feeTerms.text}</p>
                    </details>

                    <p className="field-help">Changing your bank account is not available yet.</p>
                </section>
            ) : (
                <section aria-labelledby="payout-setup-heading" className="card form-card">
                    <h2 id="payout-setup-heading">Add your bank account</h2>

                    {unfinishedAccounts.length > 0 && (
                        <Notice kind="warning">
                            <p>
                                {unfinishedAccounts.some((account) => account.status === "FAILED")
                                    ? "Your payout setup is not finished."
                                    : "Your payout setup is still in progress."}
                            </p>
                            <ProviderStatusList accounts={accounts} />
                            {activeAccount
                                ? (
                                    <p>
                                        Use the same bank account as before ({activeAccount.bankName}, ending {activeAccount.accountNumberLast4})
                                        and set up again. Providers that already work will not be changed.
                                    </p>
                                )
                                : <p>Check your details below and set up again.</p>}
                        </Notice>
                    )}

                    <form onSubmit={handleSubmit}>
                        <BankPicker banks={banks} value={bankId} onChange={setBankId} disabled={isSubmitting} />

                        <label>
                            Account number
                            <input
                                name="accountNumber"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={10}
                                aria-describedby={accountStatusId}
                                value={accountNumber}
                                disabled={isSubmitting}
                                onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
                            />
                        </label>

                        <div id={accountStatusId} className="field-status">
                            {isChecking && <p role="status" className="field-help">Checking the account...</p>}
                            {resolved?.kind === "found" && (
                                <Notice kind="success">
                                    <p>Account name: <strong>{resolved.accountName}</strong></p>
                                    <p>Check that this is your account before you continue.</p>
                                </Notice>
                            )}
                            {resolved?.kind === "invalid" && (
                                <Notice kind="error">We could not find an account with those details. Check the bank and account number.</Notice>
                            )}
                            {resolved?.kind === "unavailable" && (
                                <Notice kind="warning">
                                    <p>We could not check the account right now.</p>
                                    <button type="button" onClick={() => setResolveAttempt((attempt) => attempt + 1)}>Try again</button>
                                </Notice>
                            )}
                            {resolved?.kind === "error" && <Notice kind="error">{resolved.message}</Notice>}
                        </div>

                        <label>
                            Business phone number
                            <input
                                name="businessPhone"
                                type="tel"
                                autoComplete="tel"
                                placeholder="0803 123 4567"
                                aria-invalid={phoneIsInvalid ? true : undefined}
                                aria-describedby={phoneIsInvalid ? phoneErrorId : undefined}
                                value={businessPhone}
                                disabled={isSubmitting}
                                onChange={(event) => setBusinessPhone(event.target.value)}
                            />
                        </label>
                        {phoneIsInvalid && (
                            <p id={phoneErrorId} className="field-error">
                                Enter a valid Nigerian mobile number, for example 0803 123 4567.
                            </p>
                        )}

                        <fieldset className="terms-fieldset" aria-describedby={termsId}>
                            <legend>Payout fee terms</legend>
                            <p id={termsId} className="terms-text">{overview.feeTerms.text}</p>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={termsAccepted}
                                    disabled={isSubmitting}
                                    onChange={(event) => setTermsAccepted(event.target.checked)}
                                />
                                I have read and accept these payout fee terms
                            </label>
                        </fieldset>

                        {submitError && <Notice kind="error">{submitError}</Notice>}

                        <button type="submit" className="btn-block btn-lg" disabled={!canSubmit}>
                            {isSubmitting ? "Setting up..." : unfinishedAccounts.length > 0 ? "Set up again" : "Set up payouts"}
                        </button>
                    </form>
                </section>
            )}
        </div>
    )
}

export default PayoutSettingsPage
