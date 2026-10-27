import { useId } from "react"
import ImagePicker from "./ImagePicker"
import { ABOUT_MAX_LENGTH, BRAND_COLORS } from "../types/branding"
import type { BrandingForm } from "../types/branding"

type BrandingFieldsProps = {
    form: BrandingForm
    setForm: (form: BrandingForm) => void
    bannerUrl: string | null // the saved banner, shown until a new one is chosen
    onBannerFile: (file: File | null) => void
    onRemoveBanner: () => void
    disabled?: boolean
}

// How the shop looks to shoppers: a wide banner, one colour, a short "about" text, social links and an
// optional WhatsApp button. All optional.
function BrandingFields({ form, setForm, bannerUrl, onBannerFile, onRemoveBanner, disabled }: BrandingFieldsProps) {
    const colorName = useId()
    const update = (change: Partial<BrandingForm>) => setForm({ ...form, ...change })

    return (
        <fieldset className="branding-fields" disabled={disabled}>
            <legend>How your shop looks</legend>
            <p className="field-help">All optional. These show on your shop page.</p>

            <ImagePicker
                label="Banner (a wide picture across the top of your shop)"
                currentUrl={bannerUrl ?? undefined}
                onChange={onBannerFile}
                disabled={disabled}
                aspect={3}
            />
            {bannerUrl && <button type="button" className="btn-text" onClick={onRemoveBanner}>Remove the banner</button>}

            <fieldset className="color-choices">
                <legend>Shop colour</legend>
                <div className="color-swatches">
                    {BRAND_COLORS.map((color) => (
                        <label key={color.key} className={`color-swatch${form.brandColor === color.key ? " is-selected" : ""}`}>
                            <input type="radio" name={colorName} value={color.key} checked={form.brandColor === color.key} onChange={() => update({ brandColor: color.key })} />
                            <span className={`color-dot${color.light ? " is-light" : ""}`} style={{ background: color.background }} aria-hidden="true" />
                            {color.name}
                        </label>
                    ))}
                </div>
            </fieldset>

            <label>
                About your shop
                <textarea maxLength={ABOUT_MAX_LENGTH} value={form.about} onChange={(event) => update({ about: event.target.value })} />
            </label>
            <p className="field-help">Up to {ABOUT_MAX_LENGTH} characters. Links are not allowed here: add your social pages below.</p>

            <div className="form-row">
                <label>
                    Instagram username
                    <input autoComplete="off" placeholder="yourshop" value={form.instagram} onChange={(event) => update({ instagram: event.target.value })} />
                </label>
                <label>
                    TikTok username
                    <input autoComplete="off" placeholder="yourshop" value={form.tiktok} onChange={(event) => update({ tiktok: event.target.value })} />
                </label>
            </div>
            <div className="form-row">
                <label>
                    Facebook page name
                    <input autoComplete="off" placeholder="yourshop" value={form.facebook} onChange={(event) => update({ facebook: event.target.value })} />
                </label>
                <label>
                    X username
                    <input autoComplete="off" placeholder="yourshop" value={form.x} onChange={(event) => update({ x: event.target.value })} />
                </label>
            </div>

            <label>
                WhatsApp number for shoppers (optional)
                <input type="tel" autoComplete="off" placeholder="0801 234 5678" value={form.whatsappNumber} onChange={(event) => update({ whatsappNumber: event.target.value })} />
            </label>
            <p className="field-help">Shown as a "Chat on WhatsApp" button on your shop. Leave it empty to hide the button. This is separate from the phone number used for your payouts.</p>
        </fieldset>
    )
}

export default BrandingFields
