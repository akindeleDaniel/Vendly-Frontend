import { lgas, states } from "nigerian-states-and-lgas"
import type { SellerProfile } from "../types/seller"

type SellerProfileFieldsProps = {
    formData: SellerProfile
    setFormData: (data: SellerProfile) => void
}

// The state and LGA lists come from the same package the backend uses to validate them.
function SellerProfileFields({ formData, setFormData }: SellerProfileFieldsProps) {
    const stateOptions = states()
    const lgaOptions = formData.state ? lgas(formData.state) ?? [] : []

    return (
        <>
            <label>
                Business name
                <input name="businessName"
                    value={formData.businessName}
                    onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                />
            </label>
            <label>
                State
                <select name="state"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value, lga: ""})}
                >
                    <option value="">Select a state</option>
                    {stateOptions.map((state) => (
                        <option key={state} value={state}>{state}</option>
                    ))}
                </select>
            </label>
            <label>
                Local government area
                <select name="lga"
                    value={formData.lga}
                    disabled={!formData.state}
                    onChange={(e) => setFormData({...formData, lga: e.target.value})}
                >
                    <option value="">{formData.state ? "Select a local government area" : "Select a state first"}</option>
                    {lgaOptions.map((lga) => (
                        <option key={lga} value={lga}>{lga}</option>
                    ))}
                </select>
            </label>
            <label>
                Shipping
                <select name="shippingPolicy"
                    value={formData.shippingPolicy}
                    onChange={(e) => setFormData({
                        ...formData,
                        shippingPolicy: e.target.value === "FIXED" ? "FIXED" : "FREE"
                    })}
                >
                    <option value="FREE">Free shipping</option>
                    <option value="FIXED">Fixed shipping cost</option>
                </select>
            </label>
            {formData.shippingPolicy === "FIXED" && (
                <label>
                    Shipping cost
                    <input type="number" min="0" step="0.01" name="shippingCost"
                        value={formData.shippingCost}
                        onChange={(e) => setFormData({...formData, shippingCost: e.target.value})}
                    />
                </label>
            )}
        </>
    )
}

export default SellerProfileFields
