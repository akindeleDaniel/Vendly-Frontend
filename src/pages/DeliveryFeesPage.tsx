import { useId, useState } from "react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { formatNaira } from "../lib/money"
import { ALL_STATES, checkDeliveryChoices, choicesFromRates, fetchShippingRates, saveDeliveryChoices } from "../lib/shippingApi"
import type { DeliveryChoices, ShippingRates } from "../lib/shippingApi"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type DeliveryFormProps = {
    saved: ShippingRates
    onSaved: () => void
}

// The form itself, started from what is saved. Remounted (by its key) after a save, so it shows what the
// backend now holds.
function DeliveryForm({ saved, onSaved }: DeliveryFormProps) {
    const chargeName = useId()
    const whereName = useId()
    const [choices, setChoices] = useState<DeliveryChoices>(() => choicesFromRates(saved))
    const [samePrice, setSamePrice] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")

    function change(next: Partial<DeliveryChoices>) {
        setChoices((current) => ({ ...current, ...next }))
    }

    function toggleState(state: string, isOn: boolean) {
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

    return (
        <form onSubmit={handleSubmit} className="delivery-form">
            <section className="card form-card" aria-labelledby="charge-heading">
                <h2 id="charge-heading">Do you charge for delivery?</h2>
                <fieldset className="choice-fieldset" disabled={isSaving}>
                    <legend className="visually-hidden">Delivery charge</legend>
                    <label className="checkbox-label">
                        <input type="radio" name={chargeName} checked={choices.isFree} onChange={() => change({ isFree: true })} />
                        No, delivery is free
                    </label>
                    <label className="checkbox-label">
                        <input type="radio" name={chargeName} checked={!choices.isFree} onChange={() => change({ isFree: false })} />
                        Yes, I charge for delivery
                    </label>
                </fieldset>
            </section>

            <section className="card form-card" aria-labelledby="where-heading">
                <h2 id="where-heading">Where do you deliver?</h2>
                <fieldset className="choice-fieldset" disabled={isSaving}>
                    <legend className="visually-hidden">States you deliver to</legend>
                    <label className="checkbox-label">
                        <input type="radio" name={whereName} checked={choices.everywhere} onChange={() => chooseWhere(true)} />
                        All {ALL_STATES.length} states
                    </label>
                    <label className="checkbox-label">
                        <input type="radio" name={whereName} checked={!choices.everywhere} onChange={() => chooseWhere(false)} />
                        Only the states I pick
                    </label>
                </fieldset>

                {!choices.everywhere && (
                    <>
                        <p className="field-help">{choices.chosen.length} of {ALL_STATES.length} states picked. Buyers in other states cannot order from you.</p>
                        <div className="action-row">
                            <button type="button" className="btn-text" onClick={() => change({ chosen: ALL_STATES })} disabled={isSaving}>Pick all</button>
                            <button type="button" className="btn-text" onClick={() => change({ chosen: [] })} disabled={isSaving}>Clear</button>
                        </div>
                        <fieldset className="state-grid" disabled={isSaving}>
                            <legend className="visually-hidden">Pick the states you deliver to</legend>
                            {ALL_STATES.map((state) => (
                                <label key={state} className="checkbox-label">
                                    <input type="checkbox" checked={choices.chosen.includes(state)} onChange={(event) => toggleState(state, event.target.checked)} />
                                    {state}
                                </label>
                            ))}
                        </fieldset>
                    </>
                )}
            </section>

            {!choices.isFree && choices.chosen.length > 0 && (
                <section className="card form-card" aria-labelledby="prices-heading">
                    <h2 id="prices-heading">Delivery price for each state</h2>
                    <p className="field-help">In naira, per order. Use 0 for a state where you deliver free.</p>
                    <div className="same-price">
                        <label>
                            Same price for every state
                            <input inputMode="decimal" value={samePrice} disabled={isSaving} onChange={(event) => setSamePrice(event.target.value)} />
                        </label>
                        <button type="button" onClick={applySamePrice} disabled={isSaving || samePrice.trim() === ""}>Apply to all {choices.chosen.length}</button>
                    </div>
                    <div className="state-prices">
                        {choices.chosen.map((state) => (
                            <label key={state} className="state-price">
                                <span>{state}</span>
                                <input
                                    inputMode="decimal"
                                    value={choices.prices[state] ?? ""}
                                    disabled={isSaving}
                                    onChange={(event) => change({ prices: { ...choices.prices, [state]: event.target.value } })}
                                />
                            </label>
                        ))}
                    </div>
                </section>
            )}

            {error && <Notice kind="error">{error}</Notice>}
            <button type="submit" className="btn-block btn-lg" disabled={isSaving}>{isSaving ? "Saving..." : "Save delivery settings"}</button>
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
        <div className="form-page-wide">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <h1>Delivery</h1>
            <p className="page-intro">Choose where you deliver and what it costs. Buyers see the fee for their state before they pay.</p>

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
                    {isSaved && <Notice kind="success">Your delivery settings are saved. Buyers see the fee for their state at checkout.</Notice>}
                    <DeliveryForm key={version} saved={state.data} onSaved={() => { setIsSaved(true); setVersion((count) => count + 1) }} />
                </>
            )}
        </div>
    )
}

export default DeliveryFeesPage
