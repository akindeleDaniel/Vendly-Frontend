import { lgas } from "nigerian-states-and-lgas"
import type { SellerProfile } from "../types/seller"

// Returns an error message for the first invalid field, or null when the form can be submitted.
export function validateSellerProfile(profile: SellerProfile): string | null {
    if (profile.businessName.trim() === "" || profile.state === "" || profile.lga === "") {
        return "All areas must be filled"
    }

    if (!lgas(profile.state)?.includes(profile.lga)) {
        return "The selected local government area does not belong to the selected state"
    }

    if (profile.shippingPolicy === "FIXED" && !/^\d+(\.\d{1,2})?$/.test(profile.shippingCost.trim())) {
        return "Shipping cost must be a non-negative amount with at most two decimal places"
    }

    return null
}

// The backend rejects a shipping cost sent with the FREE policy, so it is only included for FIXED.
export function buildSellerProfileBody(profile: SellerProfile, logoUrl: string) {
    return {
        businessName: profile.businessName.trim(),
        state: profile.state,
        lga: profile.lga,
        logoUrl,
        shippingPolicy: profile.shippingPolicy,
        ...(profile.shippingPolicy === "FIXED" ? { shippingCost: profile.shippingCost.trim() } : {})
    }
}
