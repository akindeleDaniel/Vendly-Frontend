import { lgas } from "nigerian-states-and-lgas"
import type { SellerProfile } from "../types/seller"
import { SHOP_NAME_MAX_LENGTH } from "./limits"

// Returns an error message for the first invalid field, or null when the form can be submitted.
export function validateSellerProfile(profile: SellerProfile): string | null {
    if (profile.businessName.trim() === "" || profile.state === "" || profile.lga === "") {
        return "All areas must be filled"
    }

    if (profile.businessName.trim().length > SHOP_NAME_MAX_LENGTH) {
        return `The shop name must be ${SHOP_NAME_MAX_LENGTH} characters or fewer`
    }

    if (!lgas(profile.state)?.includes(profile.lga)) {
        return "The selected local government area does not belong to the selected state"
    }

    if (profile.shippingPolicy === "FIXED" && !/^\d+(\.\d{1,2})?$/.test(profile.shippingCost.trim())) {
        return "Shipping cost must be a non-negative amount with at most two decimal places"
    }

    return null
}

// The shop link the backend makes from a name (lib/generateSlug.ts there). A taken one gets a number added.
export function shopSlug(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "shop"
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
