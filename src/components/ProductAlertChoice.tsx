import { useId } from "react"
import { Link } from "react-router-dom"
import { ALERT_MAX } from "../lib/stock"

export type AlertChoice = "shop" | "own" | "off"

type ProductAlertChoiceProps = {
    choice: AlertChoice
    ownNumber: string
    shopNumber: number | null // the shop's alert number, when known
    hasOptions: boolean
    disabled?: boolean
    onChange: (choice: AlertChoice, ownNumber: string) => void
}

// On a product's edit page: email the seller at the shop's number, at a number of its own, or never.
function ProductAlertChoice({ choice, ownNumber, shopNumber, hasOptions, disabled = false, onChange }: ProductAlertChoiceProps) {
    const name = useId()
    const ownId = useId()
    const shopText = shopNumber === null
        ? "Email me at the number set for the whole shop."
        : shopNumber === 0 ? "Your shop's alerts are off at the moment." : `Email me at ${shopNumber} or fewer left.`

    return (
        <fieldset className="product-alert" disabled={disabled}>
            <legend>Low-stock alert</legend>
            <label className={`product-alert-choice${choice === "shop" ? " is-on" : ""}`}>
                <input type="radio" name={name} checked={choice === "shop"} onChange={() => onChange("shop", ownNumber)} />
                <span>
                    <b>Use my shop's number</b>
                    <span>{shopText} <Link to="/seller/profile/edit#low-stock">Change it in Shop details</Link></span>
                </span>
            </label>
            <label className={`product-alert-choice${choice === "own" ? " is-on" : ""}`}>
                <input type="radio" name={name} checked={choice === "own"} onChange={() => onChange("own", ownNumber)} />
                <span>
                    <b>Its own number</b>
                    <span>For something that sells fast, or slowly.</span>
                </span>
            </label>
            {choice === "own" && (
                <div className="product-alert-own">
                    <label htmlFor={ownId}>Email me at</label>
                    <input
                        id={ownId}
                        className="product-input"
                        type="number"
                        min="1"
                        max={ALERT_MAX}
                        step="1"
                        inputMode="numeric"
                        value={ownNumber}
                        onChange={(event) => onChange("own", event.target.value)}
                    />
                    <span>or fewer left</span>
                </div>
            )}
            <label className={`product-alert-choice${choice === "off" ? " is-on" : ""}`}>
                <input type="radio" name={name} checked={choice === "off"} onChange={() => onChange("off", ownNumber)} />
                <span>
                    <b>No alerts for this product</b>
                    <span>For something made to order, or that you don't restock.</span>
                </span>
            </label>
            {hasOptions && <p className="product-help">The number is used for each option and size on its own.</p>}
        </fieldset>
    )
}

export default ProductAlertChoice
