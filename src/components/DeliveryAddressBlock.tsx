import type { DeliveryAddress } from "../types/order"

// Who an order is going to and the full address, as the buyer typed it at checkout.
function DeliveryAddressBlock({ delivery }: { delivery: DeliveryAddress }) {
    return (
        <address className="delivery-address">
            <span className="delivery-name">{delivery.fullName}</span>
            <span><a href={`tel:${delivery.phone.replace(/\s/g, "")}`}>{delivery.phone}</a></span>
            <span>{delivery.address}</span>
            <span>{delivery.lga}, {delivery.state}</span>
            {delivery.instructions && <span className="delivery-instructions">Instructions: {delivery.instructions}</span>}
        </address>
    )
}

export default DeliveryAddressBlock
