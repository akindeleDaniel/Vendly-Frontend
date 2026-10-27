import { useEffect, useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check, CircleAlert, Landmark, Lock, Minus, RotateCcw } from "lucide-react"
import AccountCheckStatus from "../components/AccountCheckStatus"
import BankPicker from "../components/BankPicker"
import ChangeBankAccountForm from "../components/ChangeBankAccountForm"
import Notice from "../components/Notice"
import SettingsLayout from "../components/SettingsLayout"
import {
    PROVIDER_NAMES,
    acceptPayoutTerms,
    createPayoutAccounts,
    fetchPayoutBanks,
    fetchPayoutOverview,
    normalizeBusinessPhone
} from "../lib/payoutApi"
import { useAccountCheck } from "../lib/useAccountCheck"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { PayoutAccount, PayoutBank, PayoutOverview, PayoutStatus } from "../types/payout"

type LoadStatus = "loading" | "ready" | "error"

const STATUS_LABELS: Record<PayoutStatus, string> = {
    ACTIVE: "Active",
    PENDING: "Setting up",
    FAILED: "Failed"
}

const LEAD = "The bank account your sales are paid into."

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

// Each payment provider and where its payout account stands. Providers with no account yet show as
// not set up.
function ProviderStatusList({ accounts }: { accounts: PayoutAccount[] }) {
    const providers = Object.keys(PROVIDER_NAMES) as Array<keyof typeof PROVIDER_NAMES>

    return (
        <ul className="settings-providers">
            {providers.map((provider) => {
                const account = accounts.find((item) => item.provider === provider)
                return (
                    <li key={provider}>
                        <b>{PROVIDER_NAMES[provider]}</b>
                        <span className={`settings-pill is-${account ? account.status.toLowerCase() : "none"}`}>{account ? STATUS_LABELS[account.status] : "Not set up"}</span>
                        {account?.status === "FAILED" && account.failureReason && <span className="settings-provider-reason">{account.failureReason}</span>}
                    </li>
                )
            })}
        </ul>
    )
}

// The fee terms in short. The full wording, which the seller accepts, comes from the backend and is
// shown in full beside this summary.
function FeeFacts() {
    return (
        <ul className="settings-facts">
            <li><span className="settings-fact-icon" aria-hidden="true"><Check size={14} /></span>StoreHatch takes no commission.</li>
            <li><span className="settings-fact-icon" aria-hidden="true"><Minus size={14} /></span>Paystack or Flutterwave deduct their fee, VAT on it, and ₦50 stamp duty on payments of ₦10,000 or more.</li>
            <li><span className="settings-fact-icon" aria-hidden="true"><RotateCcw size={14} /></span>A refund after you're paid comes out of later sales, never more than half your share of any one order.</li>
        </ul>
    )
}

function PayoutSettingsPage({ hasPassword }: { hasPassword: boolean }) {
    const navigate = useNavigate()
    const termsId = useId()
    const accountNumberId = useId()
    const phoneId = useId()
    const phoneErrorId = useId()
    const accountStatusId = useId()
    useDocumentTitle("Payouts")

    const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading")
    const [loadError, setLoadError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [banks, setBanks] = useState<PayoutBank[]>([])
    const [overview, setOverview] = useState<PayoutOverview | null>(null)
    const [version, setVersion] = useState(0)// refreshes the menu's payout status after a change

    const [bankId, setBankId] = useState("")
    const [accountNumber, setAccountNumber] = useState("")
    const [businessPhone, setBusinessPhone] = useState("")
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState("")
    const [justSetUp, setJustSetUp] = useState(false)
    const [notice, setNotice] = useState("")
    const [isChanging, setIsChanging] = useState(false)
    const [updatedTermsAccepted, setUpdatedTermsAccepted] = useState(false)
    const [isAcceptingTerms, setIsAcceptingTerms] = useState(false)
    const [termsError, setTermsError] = useState("")

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
    const check = useAccountCheck(bankId, accountNumber)
    const resolved = check.result

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
        setVersion((count) => count + 1)
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
                window.scrollTo({ top: 0, behavior: "smooth" })
                await refreshOverview()
                return
            }

            setSubmitError(outcome.message)

            if (outcome.kind === "incomplete") {
                setOverview((current) => current && { ...current, accounts: outcome.accounts })
                setVersion((count) => count + 1)
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

    // Accepts the current payout terms again after the wording changed.
    async function handleAcceptTerms() {
        if (!overview || !updatedTermsAccepted || isAcceptingTerms) {
            return
        }

        setIsAcceptingTerms(true)
        setTermsError("")
        const outcome = await acceptPayoutTerms(overview.feeTerms.version)
        setIsAcceptingTerms(false)

        if (outcome.kind === "ok") {
            setUpdatedTermsAccepted(false)
            setNotice("Thank you. You have accepted the current payout terms.")
            await refreshOverview()
        } else if (outcome.kind === "outdated") {
            setTermsError(outcome.message)
            setUpdatedTermsAccepted(false)
            await refreshOverview()
        } else if (outcome.kind === "error") {
            setTermsError(outcome.message)
        }
    }

    if (loadStatus === "loading") {
        return <SettingsLayout title="Payouts" lead={LEAD}><p role="status">Loading your payout settings...</p></SettingsLayout>
    }

    if (loadStatus === "error" || overview === null) {
        return (
            <SettingsLayout title="Payouts" lead={LEAD}>
                <Notice kind="error">
                    <p>{loadError || "We could not load your payout settings."} Please check your connection and try again.</p>
                    <button type="button" onClick={() => {
                        setLoadStatus("loading")
                        setLoadAttempt((attempt) => attempt + 1)
                    }}>Try again</button>
                </Notice>
            </SettingsLayout>
        )
    }

    const accounts = overview.accounts
    const isSetUp = isFullySetUp(accounts)
    const activeAccount = accounts.find((account) => account.status === "ACTIVE")
    const unfinishedAccounts = accounts.filter((account) => account.status !== "ACTIVE")
    const acceptedOn = formatDate(overview.feeTermsAcceptedAt)

    if (isSetUp && activeAccount) {
        return (
            <SettingsLayout title="Payouts" lead={LEAD} version={version}>
                <div className="settings-grid">
                    <div className="product-form-main">
                        {notice && <Notice kind="success">{notice}</Notice>}
                        <Notice kind="success">
                            <p><b>{justSetUp ? "Your payout account is set up." : "Payouts are on."}</b> Buyers can pay you, and your share of each sale is paid into this account.</p>
                        </Notice>

                        <section className="product-form-card" aria-labelledby="payout-account-heading">
                            <h2 id="payout-account-heading">Your payout account</h2>
                            <div className="settings-bank">
                                <span className="settings-bank-icon" aria-hidden="true"><Landmark size={22} /></span>
                                <div>
                                    <b>{activeAccount.bankName}</b>
                                    <span>
                                        {activeAccount.accountName} · <span aria-hidden="true">•••••• {activeAccount.accountNumberLast4}</span>
                                        <span className="visually-hidden">account ending in {activeAccount.accountNumberLast4}</span>
                                    </span>
                                </div>
                                <span className="settings-pill is-active">Active</span>
                            </div>
                            {(overview.businessPhone || acceptedOn) && (
                                <dl className="settings-details">
                                    {overview.businessPhone && <div><dt>Business phone</dt><dd>{overview.businessPhone}</dd></div>}
                                    {acceptedOn && <div><dt>Fee terms accepted</dt><dd>{acceptedOn}</dd></div>}
                                </dl>
                            )}
                            <div className="product-field">
                                <h3 className="settings-legend">Payment providers</h3>
                                <ProviderStatusList accounts={accounts} />
                                <p className="product-help">Buyers pay through one of these. Each pays your share into the account above.</p>
                            </div>
                        </section>

                        {overview.acceptedFeeTermsVersion !== overview.feeTerms.version && (
                            <section className="product-form-card" aria-labelledby="terms-update-heading">
                                <h2 id="terms-update-heading">The payout terms have been updated</h2>
                                <div className="settings-terms" tabIndex={0} aria-label="The updated payout terms">{overview.feeTerms.text}</div>
                                <p className="product-help">StoreHatch can only recover refunds from your later sales once you have accepted the current terms.</p>
                                <label className="settings-check">
                                    <input type="checkbox" checked={updatedTermsAccepted} disabled={isAcceptingTerms} onChange={(event) => setUpdatedTermsAccepted(event.target.checked)} />
                                    I have read and accept the updated terms
                                </label>
                                {termsError && <Notice kind="error">{termsError}</Notice>}
                                <div className="settings-actions">
                                    <button type="button" className="btn btn-primary" disabled={!updatedTermsAccepted || isAcceptingTerms} onClick={handleAcceptTerms}>
                                        {isAcceptingTerms ? "Saving..." : "Accept the updated terms"}
                                    </button>
                                </div>
                            </section>
                        )}

                        <section className="product-form-card" aria-labelledby="change-bank-heading">
                            <h2 id="change-bank-heading">Change your bank account</h2>
                            {!hasPassword ? (
                                <Notice kind="info">
                                    <p>You signed up with Google, so your account has no password yet. A password is needed to change your bank account.</p>
                                    <Link to="/change-password" className="btn">Set a password</Link>
                                </Notice>
                            ) : isChanging ? (
                                <>
                                    <ChangeBankAccountForm
                                        banks={banks}
                                        onChanged={(updatedAccounts, fullyDone) => {
                                            setOverview((current) => current && { ...current, accounts: updatedAccounts })
                                            setNotice(fullyDone ? "Your bank account has been changed." : "")
                                            if (fullyDone) {
                                                setIsChanging(false)
                                            }
                                            void refreshOverview()
                                        }}
                                    />
                                    <button type="button" className="btn-text settings-cancel" onClick={() => setIsChanging(false)}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <p className="product-help settings-card-lead">Your payouts go to the new account from your next sale. Sales already paid aren't affected.</p>
                                    <div className="settings-actions">
                                        <button type="button" className="btn" aria-expanded="false" onClick={() => { setIsChanging(true); setNotice("") }}>Change bank account</button>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>

                    <aside className="product-form-aside" aria-label="How you're paid">
                        <div className="settings-mini">
                            <h2>How you're paid</h2>
                            <FeeFacts />
                            <div className="settings-example" aria-label="Example">
                                <span>A ₦20,000 card sale</span><span>₦20,000</span>
                                <span>Card fee (1.5% + ₦100)</span><span>−₦400</span>
                                <b>You receive about</b><b>₦19,600</b>
                            </div>
                            <p className="product-help">Less stamp duty where it applies. Every paid order shows the fee actually taken.</p>
                            <details className="settings-more">
                                <summary>Read the full payout terms</summary>
                                <div className="settings-terms">{overview.feeTerms.text}</div>
                            </details>
                        </div>
                        <Link to="/seller/liabilities" className="btn">Refunds and amounts owed</Link>
                    </aside>
                </div>
            </SettingsLayout>
        )
    }

    return (
        <SettingsLayout title="Payouts" lead={LEAD} version={version}>
            <div className="settings-grid">
                <div className="product-form-main">
                    {unfinishedAccounts.length > 0 ? (
                        <Notice kind="warning">
                            <p>
                                <b>{unfinishedAccounts.some((account) => account.status === "FAILED") ? "Your payout setup isn't finished." : "Your payout setup is still in progress."}</b>{" "}
                                {activeAccount
                                    ? `Use the same bank account as before (${activeAccount.bankName}, ending ${activeAccount.accountNumberLast4}) and set up again. Providers that already work won't be changed.`
                                    : "Check your details below and set up again."}
                            </p>
                        </Notice>
                    ) : (
                        <div className="settings-alert" role="status">
                            <span className="settings-alert-icon" aria-hidden="true"><CircleAlert size={18} /></span>
                            <p><b>Buyers can't pay you yet.</b> Add the bank account your sales are paid into. Until then, shoppers can see your products but can't check out.</p>
                        </div>
                    )}

                    <form className="product-form-card" aria-labelledby="payout-setup-heading" onSubmit={handleSubmit}>
                        <h2 id="payout-setup-heading">Add your bank account</h2>

                        <div className="settings-step"><span aria-hidden="true">1</span><h3>Your bank account</h3></div>
                        <fieldset className="settings-fieldset" disabled={isSubmitting}>
                            <legend className="visually-hidden">Your bank account</legend>
                            <div className="product-two settings-bank-fields">
                                <BankPicker banks={banks} value={bankId} onChange={setBankId} disabled={isSubmitting} />
                                <div className="product-field">
                                    <label htmlFor={accountNumberId}>Account number</label>
                                    <input
                                        id={accountNumberId}
                                        className="product-input"
                                        name="accountNumber"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        maxLength={10}
                                        aria-describedby={accountStatusId}
                                        value={accountNumber}
                                        onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
                                    />
                                </div>
                            </div>
                            <AccountCheckStatus check={check} id={accountStatusId} />
                        </fieldset>

                        <div className="settings-step"><span aria-hidden="true">2</span><h3>Your business phone</h3></div>
                        <div className="product-field settings-narrow">
                            <label htmlFor={phoneId}>Phone number</label>
                            <input
                                id={phoneId}
                                className="product-input"
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
                            {phoneIsInvalid
                                ? <p id={phoneErrorId} className="field-error">Enter a valid Nigerian mobile number, for example 0803 123 4567.</p>
                                : <p className="product-help">Paystack and Flutterwave need it for your payout account.</p>}
                        </div>

                        <div className="settings-step"><span aria-hidden="true">3</span><h3>The payout fee terms</h3></div>
                        <FeeFacts />
                        <div id={termsId} className="settings-terms" tabIndex={0} aria-label="Payout fee terms">{overview.feeTerms.text}</div>
                        <label className="settings-check">
                            <input type="checkbox" checked={termsAccepted} disabled={isSubmitting} aria-describedby={termsId} onChange={(event) => setTermsAccepted(event.target.checked)} />
                            I have read and accept these payout fee terms
                        </label>

                        {submitError && <Notice kind="error">{submitError}</Notice>}

                        <button type="submit" className="btn btn-primary settings-submit" disabled={!canSubmit}>
                            {isSubmitting ? "Setting up..." : unfinishedAccounts.length > 0 ? "Set up again" : "Set up payouts"}
                        </button>
                        <p className="settings-trust"><Lock size={16} aria-hidden="true" />StoreHatch never asks for your bank login, PIN, OTP or BVN.</p>
                    </form>
                </div>

                <aside className="product-form-aside" aria-label="What happens next">
                    <div className="settings-mini">
                        <h2>What happens next</h2>
                        <ol className="settings-next">
                            <li>We set up your account with Paystack and Flutterwave.</li>
                            <li>When both show <b>Active</b>, buyers can pay you.</li>
                            <li>Your share of each sale is paid into this account on the provider's usual schedule.</li>
                        </ol>
                    </div>
                    <div className="settings-mini">
                        <h2>Payment providers</h2>
                        <ProviderStatusList accounts={accounts} />
                    </div>
                </aside>
            </div>
        </SettingsLayout>
    )
}

export default PayoutSettingsPage
