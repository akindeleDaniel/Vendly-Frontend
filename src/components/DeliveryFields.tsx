import { lgas, states } from "nigerian-states-and-lgas"
import type { DeliveryDetails } from "../types/checkout"

type DeliveryFieldsProps = {
    formData: DeliveryDetails
    setFormData: (data: DeliveryDetails) => void
    disabled?: boolean
    invalidField?: keyof DeliveryDetails// the field the validation message is about
    errorId?: string// id of the element that holds that message
}

// The state and LGA lists come from the same package the backend uses to validate them.
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
            <label>
                Delivery address
                <textarea name="address" {...fieldProps("address")}
                    autoComplete="street-address"
                    value={formData.address}
                    disabled={disabled}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
            </label>
            <label>
                State
                <select name="state" {...fieldProps("state")}
                    value={formData.state}
                    disabled={disabled}
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
                <select name="lga" {...fieldProps("lga")}
                    value={formData.lga}
                    disabled={disabled || !formData.state}
                    onChange={(e) => setFormData({...formData, lga: e.target.value})}
                >
                    <option value="">{formData.state ? "Select a local government area" : "Select a state first"}</option>
                    {lgaOptions.map((lga) => (
                        <option key={lga} value={lga}>{lga}</option>
                    ))}
                </select>
            </label>
            <label>
                Delivery instructions (optional)
                <textarea name="instructions" {...fieldProps("instructions")}
                    value={formData.instructions}
                    disabled={disabled}
                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                />
            </label>
        </>
    )
}

export default DeliveryFields
