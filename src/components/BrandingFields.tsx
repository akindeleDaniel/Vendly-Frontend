import { useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import { TriangleAlert } from "lucide-react"
import ImagePicker from "./ImagePicker"
import { ABOUT_MAX_LENGTH, BRAND_COLORS } from "../types/branding"
import type { BrandingForm } from "../types/branding"

type ShopLookFieldsProps = {
    form: BrandingForm
    setForm: (form: BrandingForm) => void
    bannerUrl: string | null // the saved banner, shown until a new one is chosen
    onBannerFile: (file: File | null) => void
    onRemoveBanner: () => void
    disabled?: boolean
    pickerKey?: number // change it to clear a banner that was chosen but not saved
    bannerStatus?: ReactNode // how the banner's upload is going, shown under it
}

// How the shop looks to shoppers: a wide banner, one colour and a short "about" text. All optional.
export function ShopLookFields({ form, setForm, bannerUrl, onBannerFile, onRemoveBanner, disabled, pickerKey, bannerStatus }: ShopLookFieldsProps) {
    const colorName = useId()
    const aboutId = useId()
    const update = (change: Partial<BrandingForm>) => setForm({ ...form, ...change })

    return (
        <section className="product-form-card" aria-labelledby={`${aboutId}-heading`}>
            <h2 id={`${aboutId}-heading`}>How your shop looks</h2>
            <p className="product-help settings-card-lead">All optional. These show on your shop page. Checkout and payment always use StoreHatch's own colours.</p>
            <fieldset className="settings-fieldset" disabled={disabled}>
                <ImagePicker
                    key={pickerKey}
                    label="Banner (a wide picture across the top of your shop)"
                    currentUrl={bannerUrl ?? undefined}
                    onChange={onBannerFile}
                    disabled={disabled}
                    aspect={3}
                />
                {bannerStatus}
                {bannerUrl && <button type="button" className="btn-text settings-remove" onClick={onRemoveBanner}>Remove the banner</button>}

                <fieldset className="settings-fieldset">
                    <legend className="settings-legend">Shop colour</legend>
                    <div className="settings-swatches">
                        {BRAND_COLORS.map((color) => (
                            <label key={color.key} className={`settings-swatch${form.brandColor === color.key ? " is-on" : ""}`}>
                                <input type="radio" name={colorName} value={color.key} checked={form.brandColor === color.key} onChange={() => update({ brandColor: color.key })} />
                                <span className={`settings-swatch-dot${color.light ? " is-light" : ""}`} style={{ background: color.background }} aria-hidden="true" />
                                {color.name}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="product-field">
                    <div className="product-field-top">
                        <label htmlFor={aboutId}>About your shop</label>
                        <small>{form.about.length} / {ABOUT_MAX_LENGTH}</small>
                    </div>
                    <textarea id={aboutId} className="product-input product-textarea" maxLength={ABOUT_MAX_LENGTH} value={form.about} onChange={(event) => update({ about: event.target.value })} />
                    <p className="product-help">Links aren't allowed here. Add your social pages below.</p>
                </div>
            </fieldset>
        </section>
    )
}

type ShopLinksFieldsProps = {
    form: BrandingForm
    setForm: (form: BrandingForm) => void
    disabled?: boolean
}

const SOCIAL_FIELDS: Array<{ key: "instagram" | "tiktok" | "facebook" | "x", label: string }> = [
    { key: "instagram", label: "Instagram username" },
    { key: "tiktok", label: "TikTok username" },
    { key: "facebook", label: "Facebook page name" },
    { key: "x", label: "X username" }
]

// The shop's social pages and an optional WhatsApp button. Each one filled in shows as an icon on the shop.
// Turning the WhatsApp button off clears the number, which is what hides the button; the number typed is kept
// on the page in case it is switched on again before saving.
export function ShopLinksFields({ form, setForm, disabled }: ShopLinksFieldsProps) {
    const id = useId()
    const update = (change: Partial<BrandingForm>) => setForm({ ...form, ...change })
    const [showWhatsapp, setShowWhatsapp] = useState(form.whatsappNumber.trim() !== "")
    const lastNumber = useRef(form.whatsappNumber)

    function switchWhatsapp(on: boolean) {
        setShowWhatsapp(on)
        if (on) {
            update({ whatsappNumber: lastNumber.current })
        } else {
            lastNumber.current = form.whatsappNumber
            update({ whatsappNumber: "" })
        }
    }

    return (
        <section className="product-form-card" aria-labelledby={`${id}-heading`}>
            <h2 id={`${id}-heading`}>Social pages and WhatsApp</h2>
            <p className="product-help settings-card-lead">Optional. Each one you fill in shows on your shop as a small icon shoppers can tap.</p>
            <fieldset className="settings-fieldset" disabled={disabled}>
                <div className="product-two">
                    {SOCIAL_FIELDS.map((field) => (
                        <div key={field.key} className="product-field">
                            <label htmlFor={`${id}-${field.key}`}>{field.label}</label>
                            <div className="product-input product-money">
                                <span aria-hidden="true">@</span>
                                <input id={`${id}-${field.key}`} autoComplete="off" placeholder="yourshop" value={form[field.key]} onChange={(event) => update({ [field.key]: event.target.value })} />
                            </div>
                        </div>
                    ))}
                </div>
                <label className="settings-switch">
                    <input type="checkbox" role="switch" checked={showWhatsapp} onChange={(event) => switchWhatsapp(event.target.checked)} />
                    <span>
                        <b>Show a WhatsApp button on your shop</b>
                        <span>Shoppers can message you before they buy.</span>
                    </span>
                </label>
                {showWhatsapp ? (
                    <>
                        <div className="product-field settings-narrow">
                            <label htmlFor={`${id}-whatsapp`}>WhatsApp number</label>
                            <input id={`${id}-whatsapp`} className="product-input" type="tel" autoComplete="off" placeholder="0801 234 5678" value={form.whatsappNumber} onChange={(event) => update({ whatsappNumber: event.target.value })} />
                        </div>
                        <p className="settings-public-warning" role="note">
                            <TriangleAlert size={18} aria-hidden="true" />
                            <span><b>This number will be public.</b> Anyone who visits your shop can see it and message you. Use a number you're happy to share. It isn't the phone number for your payouts.</span>
                        </p>
                    </>
                ) : (
                    <p className="product-help">No WhatsApp button on your shop. Shoppers can still buy and ask questions through StoreHatch.</p>
                )}
            </fieldset>
        </section>
    )
}
