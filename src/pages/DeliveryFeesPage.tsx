import { useId, useState } from "react"
import { Check, MapPin, Search, Tag } from "lucide-react"
import Notice from "../components/Notice"
import SettingsLayout from "../components/SettingsLayout"
import { formatNaira } from "../lib/money"
import { ALL_STATES, checkDeliveryChoices, choicesFromRates, fetchShippingRates, saveDeliveryChoices } from "../lib/shippingApi"
import type { DeliveryChoices, ShippingRates } from "../lib/shippingApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type DeliveryFormProps = {
    saved: ShippingRates
    onSaved: () => void
}

function priceNumber(value: string | undefined): number | null {
    const trimmed = (value ?? "").trim().replace(/,/g, "")
    return trimmed !== "" && Number.isFinite(Number(trimmed)) ? Number(trimmed) : null
}

// What a buyer in one state pays, and a short summary of where the shop delivers and for how much.
function DeliveryAside({ choices }: { choices: DeliveryChoices }) {
    const tryId = useId()
    const [tryState, setTryState] = useState(() => choices.chosen[0] ?? "Lagos")
    const delivers = choices.chosen.includes(tryState)
    const fee = choices.isFree ? 0 : priceNumber(choices.prices[tryState])
    const prices = choices.chosen.map((state) => priceNumber(choices.prices[state])).filter((price): price is number => price !== null)
    const lowest = prices.length > 0 ? Math.min(...prices) : null
    const highest = prices.length > 0 ? Math.max(...prices) : null

    const where = choices.chosen.length === ALL_STATES.length
        ? `You deliver to all ${ALL_STATES.length} states.`
        : choices.chosen.length === 0
            ? "You haven't picked any states yet."
            : `You deliver to ${choices.chosen.length} of ${ALL_STATES.length} states. Buyers elsewhere can't order.`
    const price = choices.isFree
        ? "Delivery is free everywhere you deliver."
        : lowest === null || highest === null
            ? "Add a price for each state."
            : lowest === highest
                ? `Every state pays ${lowest === 0 ? "nothing" : formatNaira(String(lowest))}.`
                : `Buyers pay ${lowest === 0 ? "nothing" : formatNaira(String(lowest))} to ${formatNaira(String(highest))}, depending on their state.`

    return (
        <aside className="product-form-aside" aria-label="What buyers pay">
            <div className="settings-mini">
                <h2>What a buyer pays</h2>
                <div className="product-field">
                    <label htmlFor={tryId}>A buyer in</label>
                    <select id={tryId} className="product-input" value={tryState} onChange={(event) => setTryState(event.target.value)}>
                        {ALL_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>
                </div>
                {delivers ? (
                    <p className="settings-fee" aria-live="polite">
                        <b>{fee === null ? "No price yet" : fee === 0 ? "Free" : formatNaira(String(fee))}</b>
                        <span>delivery, added to their order at checkout</span>
                    </p>
                ) : (
                    <Notice kind="warning">You don't deliver to {tryState}. Buyers there see your products but can't order.</Notice>
                )}
            </div>
            <div className="settings-mini">
                <h2>In short</h2>
                <ul className="settings-facts">
                    <li><span className="settings-fact-icon" aria-hidden="true"><MapPin size={14} /></span>{where}</li>
                    <li><span className="settings-fact-icon" aria-hidden="true"><Tag size={14} /></span>{price}</li>
                </ul>
            </div>
        </aside>
    )
}

// The form itself, started from what is saved. Remounted (by its key) after a save, so it shows what the
// backend now holds.
function DeliveryForm({ saved, onSaved }: DeliveryFormProps) {
    const chargeName = useId()
    const whereName = useId()
    const searchId = useId()
    const sameId = useId()
    const [choices, setChoices] = useState<DeliveryChoices>(() => choicesFromRates(saved))
    const [search, setSearch] = useState("")
    const [samePrice, setSamePrice] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")

    function change(next: Partial<DeliveryChoices>) {
        setChoices((current) => ({ ...current, ...next }))
    }

    function toggleState(state: string) {
        const isOn = !choices.chosen.includes(state)
        const chosen = isOn ? ALL_STATES.filter((name) => name === state || choices.chosen.includes(name)) : choices.chosen.filter((name) => name !== state)
        change({ chosen })
    }

    function chooseWhere(everywhere: boolean) {
        change({ everywhere, chosen: everywhere ? ALL_STATES : choices.chosen.length === ALL_STATES.length ? [] : choices.chosen })
    }

    function applySamePrice() {
        const prices = { ...choices.prices }
        for (const state of choices.chosen) {
            prices[state] = samePrice.trim()
        }
        change({ prices })
    }

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSaving) {
            return
        }

        const problem = checkDeliveryChoices(choices)
        if (problem) {
            setError(problem)
            return
        }

        setIsSaving(true)
        setError("")
        const failure = await saveDeliveryChoices(choices)
        setIsSaving(false)

        if (failure) {
            setError(failure)
            return
        }

        onSaved()
    }

    const query = search.trim().toLowerCase()
    const shownStates = query ? ALL_STATES.filter((state) => state.toLowerCase().includes(query)) : ALL_STATES

    return (
        <form onSubmit={handleSubmit} className="settings-grid">
            <div className="product-form-main">
                <section className="product-form-card" aria-labelledby="charge-heading">
                    <h2 id="charge-heading">Do you charge for delivery?</h2>
                    <fieldset className="settings-choices" disabled={isSaving}>
                        <legend className="visually-hidden">Delivery charge</legend>
                        <label className={`settings-choice${choices.isFree ? " is-on" : ""}`}>
                            <input type="radio" name={chargeName} checked={choices.isFree} onChange={() => change({ isFree: true })} />
                            <span><b>No, delivery is free</b><span>Buyers pay only for the items.</span></span>
                        </label>
                        <label className={`settings-choice${!choices.isFree ? " is-on" : ""}`}>
                            <input type="radio" name={chargeName} checked={!choices.isFree} onChange={() => change({ isFree: false })} />
                            <span><b>Yes, I charge</b><span>Set a price for each state you deliver to.</span></span>
                        </label>
                    </fieldset>
                </section>

                <section className="product-form-card" aria-labelledby="where-heading">
                    <h2 id="where-heading">Where do you deliver?</h2>
                    <fieldset className="settings-choices" disabled={isSaving}>
                        <legend className="visually-hidden">States you deliver to</legend>
                        <label className={`settings-choice${choices.everywhere ? " is-on" : ""}`}>
                            <input type="radio" name={whereName} checked={choices.everywhere} onChange={() => chooseWhere(true)} />
                            <span><b>All {ALL_STATES.length} states</b><span>Anyone in Nigeria can order.</span></span>
                        </label>
                        <label className={`settings-choice${!choices.everywhere ? " is-on" : ""}`}>
                            <input type="radio" name={whereName} checked={!choices.everywhere} onChange={() => chooseWhere(false)} />
                            <span><b>Only the states I pick</b><span>Buyers elsewhere can't order from you.</span></span>
                        </label>
                    </fieldset>

                    {!choices.everywhere && (
                        <>
                            <div className="settings-state-tools">
                                <div className="product-input product-money settings-search">
                                    <Search size={16} aria-hidden="true" />
                                    <input id={searchId} aria-label="Find a state" placeholder="Find a state" value={search} onChange={(event) => setSearch(event.target.value)} />
                                </div>
                                <div className="settings-state-count">
                                    <b aria-live="polite">{choices.chosen.length} of {ALL_STATES.length} picked</b>
                                    <button type="button" className="btn-text" onClick={() => change({ chosen: ALL_STATES })} disabled={isSaving}>Pick all</button>
                                    <button type="button" className="btn-text" onClick={() => change({ chosen: [] })} disabled={isSaving}>Clear</button>
                                </div>
                            </div>
                            <div className="settings-states" role="group" aria-label="Pick the states you deliver to">
                                {shownStates.map((state) => {
                                    const isOn = choices.chosen.includes(state)
                                    return (
                                        <button key={state} type="button" className={`settings-state${isOn ? " is-on" : ""}`} aria-pressed={isOn} disabled={isSaving} onClick={() => toggleState(state)}>
                                            <span className="settings-state-box" aria-hidden="true">{isOn && <Check size={12} strokeWidth={3.5} />}</span>
                                            {state}
                                        </button>
                                    )
                                })}
                                {shownStates.length === 0 && <p className="product-help">No state matches "{search.trim()}".</p>}
                            </div>
                        </>
                    )}
                </section>

                {!choices.isFree && choices.chosen.length > 0 && (
                    <section className="product-form-card" aria-labelledby="prices-heading">
                        <h2 id="prices-heading">Delivery price for each state</h2>
                        <p className="product-help settings-card-lead">In naira, per order. Use 0 for a state where delivery is free.</p>
                        <div className="settings-same">
                            <div className="product-field">
                                <label htmlFor={sameId}>Same price for every state</label>
                                <div className="product-input product-money">
                                    <span aria-hidden="true">₦</span>
                                    <input id={sameId} inputMode="decimal" value={samePrice} disabled={isSaving} onChange={(event) => setSamePrice(event.target.value)} />
                                </div>
                            </div>
                            <button type="button" className="btn" onClick={applySamePrice} disabled={isSaving || samePrice.trim() === ""}>Apply to all {choices.chosen.length}</button>
                        </div>
                        <div className="settings-prices">
                            {choices.chosen.map((state) => (
                                <label key={state} className="settings-price">
                                    <span className="settings-price-name">{state}</span>
                                    {priceNumber(choices.prices[state]) === 0 && <span className="settings-free">Free</span>}
                                    <span className="product-input product-money">
                                        <span aria-hidden="true">₦</span>
                                        <input
                                            inputMode="decimal"
                                            value={choices.prices[state] ?? ""}
                                            disabled={isSaving}
                                            onChange={(event) => change({ prices: { ...choices.prices, [state]: event.target.value } })}
                                        />
                                    </span>
                                </label>
                            ))}
                        </div>
                    </section>
                )}

                {error && <Notice kind="error">{error}</Notice>}
                <div className="settings-actions">
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Saving..." : "Save delivery"}</button>
                </div>
            </div>

            <DeliveryAside choices={choices} />
        </form>
    )
}

// Where a seller delivers and what each state pays. Buyers are charged the fee for their delivery state.
function DeliveryFeesPage() {
    useDocumentTitle("Delivery")
    const [version, setVersion] = useState(0)// a save loads the settings again and restarts the form
    const [isSaved, setIsSaved] = useState(false)
    const { state, reload } = useApiResource(`delivery-${version}`, (signal) => fetchShippingRates(signal))

    return (
        <SettingsLayout title="Delivery" lead="Where you deliver and what it costs. Buyers see the fee for their state before they pay." version={version}>
            {state.kind === "loading" && <p role="status">Loading your delivery settings...</p>}
            {state.kind === "error" && (
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            )}
            {state.kind === "ready" && (
                <>
                    {state.data.shippingPolicy === "FIXED" && state.data.shippingCost && state.data.rates.length === 0 && (
                        <Notice kind="info">Today every state pays your standard fee of {formatNaira(state.data.shippingCost)}.</Notice>
                    )}
                    {isSaved && <Notice kind="success"><p><b>Delivery is saved.</b> Buyers see the fee for their state at checkout.</p></Notice>}
                    <DeliveryForm key={version} saved={state.data} onSaved={() => { setIsSaved(true); setVersion((count) => count + 1); window.scrollTo({ top: 0, behavior: "smooth" }) }} />
                </>
            )}
        </SettingsLayout>
    )
}

export default DeliveryFeesPage
