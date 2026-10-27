import { lgas, states } from "nigerian-states-and-lgas"
import type { DeliveryDetails } from "../types/checkout"

type DeliveryFieldsProps = {
    formData: DeliveryDetails
    setFormData: (data: DeliveryDetails) => void
    disabled?: boolean
    invalidField?: keyof DeliveryDetails// the field the validation message is about
    errorId?: string// id of the element that holds that message
}

// Where the order goes, then who receives it. The state comes first because each shop's delivery
// fee depends on it. The state and LGA lists come from the same package the backend uses to validate them.
function DeliveryFields({ formData, setFormData, disabled, invalidField, errorId }: DeliveryFieldsProps) {
    const stateOptions = states()
    const lgaOptions = formData.state ? lgas(formData.state) ?? [] : []

    function fieldProps(name: keyof DeliveryDetails) {
        return invalidField === name
            ? { "aria-invalid": true, "aria-describedby": errorId }
            : {}
    }

    return (
        <>
            <div className="checkout-pair">
                <label>
                    State
                    <select name="state" {...fieldProps("state")}
                        value={formData.state}
                        disabled={disabled}
                        onChange={(e) => setFormData({...formData, state: e.target.value, lga: ""})}
                    >
                        <option value="">Choose your state</option>
                        {stateOptions.map((state) => (
                            <option key={state} value={state}>{state}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Local government area
                    <select name="lga" {...fieldProps("lga")}
                        value={formData.lga}
                        disabled={disabled || !formData.state}
                        onChange={(e) => setFormData({...formData, lga: e.target.value})}
                    >
                        <option value="">{formData.state ? "Choose your area" : "Choose a state first"}</option>
                        {lgaOptions.map((lga) => (
                            <option key={lga} value={lga}>{lga}</option>
                        ))}
                    </select>
                </label>
            </div>
            <label>
                Street address
                <textarea name="address" {...fieldProps("address")}
                    autoComplete="street-address"
                    placeholder="House number, street, area and a landmark"
                    value={formData.address}
                    disabled={disabled}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
            </label>

            <div className="checkout-divider" />
            <h2 className="checkout-subheading">Who receives it?</h2>
            <p className="checkout-lead">The rider calls this number on the day. It can be someone else.</p>
            <div className="checkout-pair">
                <label>
                    Full name
                    <input name="fullName" {...fieldProps("fullName")}
                        autoComplete="name"
                        value={formData.fullName}
                        disabled={disabled}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    />
                </label>
                <label>
                    Phone number
                    <input name="phone" type="tel" {...fieldProps("phone")}
                        autoComplete="tel"
                        value={formData.phone}
                        disabled={disabled}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                </label>
            </div>
            <label>
                Note for the rider <span className="checkout-optional">(optional)</span>
                <textarea name="instructions" {...fieldProps("instructions")}
                    placeholder="For example: call when you reach the gate"
                    value={formData.instructions}
                    disabled={disabled}
                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                />
            </label>
        </>
    )
}

export default DeliveryFields
