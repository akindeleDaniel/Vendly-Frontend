import type { BrandingForm, ShopBranding } from "../types/branding"

export const EMPTY_BRANDING_FORM: BrandingForm = {
    brandColor: "forest",
    about: "",
    instagram: "",
    tiktok: "",
    facebook: "",
    x: "",
    whatsappNumber: ""
}

// The saved branding as form values. A missing branding object (an older backend) is the empty form.
export function brandingFormFrom(branding: ShopBranding | undefined | null): BrandingForm {
    if (!branding) {
        return EMPTY_BRANDING_FORM
    }

    return {
        brandColor: branding.brandColor?.key ?? "forest",
        about: branding.about ?? "",
        instagram: branding.social?.instagram?.handle ?? "",
        tiktok: branding.social?.tiktok?.handle ?? "",
        facebook: branding.social?.facebook?.handle ?? "",
        x: branding.social?.x?.handle ?? "",
        whatsappNumber: branding.whatsapp?.number ?? ""
    }
}

export function brandingChanged(a: BrandingForm, b: BrandingForm): boolean {
    return (Object.keys(a) as Array<keyof BrandingForm>).some((key) => a[key].trim() !== b[key].trim())
}

// The branding fields for PATCH /seller/profile. An empty field clears it; the backend checks the rest
// (handle shapes, "no links" in the about text, a Nigerian mobile number) and says what is wrong.
export function brandingBody(form: BrandingForm, bannerUrl: string | null) {
    const handle = (value: string) => value.trim().replace(/^@/, "")

    return {
        bannerUrl: bannerUrl ?? null,
        brandColor: form.brandColor,
        about: form.about.trim(),
        instagram: handle(form.instagram),
        tiktok: handle(form.tiktok),
        facebook: handle(form.facebook),
        x: handle(form.x),
        whatsappNumber: form.whatsappNumber.trim()
    }
}
