import { useId } from "react"
import { lgas, states } from "nigerian-states-and-lgas"
import { SHOP_NAME_MAX_LENGTH } from "../lib/limits"
import { shopSlug } from "../lib/sellerProfile"
import type { SellerProfile } from "../types/seller"

type ShopBasicsFieldsProps = {
    formData: SellerProfile
    onChange: (next: SellerProfile) => void
    showLink?: boolean // shows the shop link the name will make, while setting up a shop
}

// The shop's name and where it sends orders from. The state and LGA lists come from the same package
// the backend checks them against.
function ShopBasicsFields({ formData, onChange, showLink = false }: ShopBasicsFieldsProps) {
    const nameId = useId()
    const stateId = useId()
    const lgaId = useId()
    const lgaOptions = formData.state ? lgas(formData.state) ?? [] : []

    return (
        <>
            <div className="product-field">
                <div className="product-field-top">
                    <label htmlFor={nameId}>Shop name</label>
                    <small>{formData.businessName.length} / {SHOP_NAME_MAX_LENGTH}</small>
                </div>
                <input
                    id={nameId}
                    className="product-input"
                    maxLength={SHOP_NAME_MAX_LENGTH}
                    placeholder={showLink ? "For example: Tolani Fabrics" : undefined}
                    value={formData.businessName}
                    onChange={(event) => onChange({ ...formData, businessName: event.target.value })}
                />
            </div>
            {showLink && (
                <div>
                    <p className="onboard-link">Your shop link: <code>/shop/{formData.businessName.trim() ? shopSlug(formData.businessName) : "your-shop-name"}</code></p>
                    <p className="product-help">Made from your shop name. If another shop already has it, we add a number to the end.</p>
                </div>
            )}
            <div className="product-two">
                <div className="product-field">
                    <label htmlFor={stateId}>State</label>
                    <select id={stateId} className="product-input" value={formData.state} onChange={(event) => onChange({ ...formData, state: event.target.value, lga: "" })}>
                        <option value="">Select a state</option>
                        {states().map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>
                </div>
                <div className="product-field">
                    <label htmlFor={lgaId}>Local government area</label>
                    <select id={lgaId} className="product-input" value={formData.lga} disabled={!formData.state} onChange={(event) => onChange({ ...formData, lga: event.target.value })}>
                        <option value="">{formData.state ? "Select a local government area" : "Select a state first"}</option>
                        {lgaOptions.map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                    </select>
                </div>
            </div>
        </>
    )
}

export default ShopBasicsFields
