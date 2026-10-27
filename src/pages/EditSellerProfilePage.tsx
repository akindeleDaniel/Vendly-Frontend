import { useEffect, useId, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check, MapPin, MessageCircle } from "lucide-react"
import { lgas, states } from "nigerian-states-and-lgas"
import { ShopLinksFields, ShopLookFields } from "../components/BrandingFields"
import ImagePicker from "../components/ImagePicker"
import Notice from "../components/Notice"
import SettingsLayout from "../components/SettingsLayout"
import ShopAvatar from "../components/ShopAvatar"
import { apiFetch, getErrorMessage } from "../lib/api"
import { EMPTY_BRANDING_FORM, brandingBody, brandingChanged, brandingFormFrom } from "../lib/branding"
import { SHOP_NAME_MAX_LENGTH } from "../lib/limits"
import { buildSellerProfileBody, validateSellerProfile } from "../lib/sellerProfile"
import { uploadImage } from "../lib/uploadImage"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { BRAND_COLORS } from "../types/branding"
import type { BrandingForm } from "../types/branding"
import type { FoodOrderType } from "../types/preOrder"
import type { SellerProfile } from "../types/seller"

type LoadStatus = "loading" | "ready" | "error"

const FOOD_CHOICES: Array<{ value: FoodOrderType, title: string, text: string }> = [
    { value: "NOW", title: "Ready now", text: "Buyers order and pay straight away." },
    { value: "PRE_ORDER", title: "Pre-orders only", text: "Buyers ask for a ready time first." },
    { value: "BOTH", title: "Both", text: "Order now, or pre-order for later." }
]

const SOCIAL_NAMES: Array<{ key: "instagram" | "tiktok" | "facebook" | "x", name: string }> = [
    { key: "instagram", name: "Instagram" },
    { key: "tiktok", name: "TikTok" },
    { key: "facebook", name: "Facebook" },
    { key: "x", name: "X" }
]

// A temporary address for a picked file, so the preview can show it before it is uploaded.
function useFileUrl(file: File | null): string | null {
    const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file])

    useEffect(() => {
        return () => {
            if (url) {
                URL.revokeObjectURL(url)
            }
        }
    }, [url])

    return url
}

type ShopPreviewProps = {
    profile: SellerProfile
    branding: BrandingForm
    logoUrl: string | null
    bannerUrl: string | null
    slug: string
}

// The top of the shop page as shoppers will see it, updated as the seller types.
function ShopPreview({ profile, branding, logoUrl, bannerUrl, slug }: ShopPreviewProps) {
    const color = BRAND_COLORS.find((choice) => choice.key === branding.brandColor) ?? BRAND_COLORS[0]
    const brandStyle = { background: color.background, color: color.text }
    const socials = SOCIAL_NAMES.flatMap((social) => {
        const handle = branding[social.key].trim().replace(/^@/, "")
        return handle ? [`${social.name} @${handle}`] : []
    })
    const place = [profile.lga, profile.state === "Federal Capital Territory" ? "FCT" : profile.state].filter(Boolean).join(", ")

    return (
        <aside className="product-form-aside" aria-label="Preview">
            <p className="settings-peek-label">How shoppers see your shop</p>
            <div className="settings-peek">
                <div className={`settings-peek-banner${color.light && !bannerUrl ? " is-light" : ""}`} style={bannerUrl ? undefined : { background: color.background }}>
                    {bannerUrl && <img src={bannerUrl} alt="" />}
                </div>
                <div className="settings-peek-body">
                    <span className="settings-peek-logo">
                        <ShopAvatar name={profile.businessName} logoUrl={logoUrl} brandColor={color} />
                    </span>
                    <p className="settings-peek-name">{profile.businessName.trim() || "Your shop name"}</p>
                    {place && <p className="settings-peek-place"><MapPin size={14} aria-hidden="true" />{place}</p>}
                    {branding.about.trim() && <p className="settings-peek-about" style={{ background: color.tint }}>{branding.about.trim()}</p>}
                    {socials.length > 0 && (
                        <div className="settings-peek-social">
                            {socials.map((social) => <span key={social}>{social}</span>)}
                        </div>
                    )}
                    {branding.whatsappNumber.trim() && (
                        <span className={`settings-peek-button${color.light ? " is-light" : ""}`} style={brandStyle}>
                            <MessageCircle size={16} aria-hidden="true" />Chat on WhatsApp
                        </span>
                    )}
                </div>
            </div>
            {slug && <Link to={`/shop/${slug}`} className="btn">See your shop page</Link>}
        </aside>
    )
}

// The shop's name, place and look, with a preview of the shop page beside the form.
function EditSellerProfilePage() {
    const navigate = useNavigate()
    const nameId = useId()
    const stateId = useId()
    const lgaId = useId()
    const foodName = useId()
    useDocumentTitle("Shop details")

    const [formData, setFormData] = useState<SellerProfile>({ businessName: "", state: "", lga: "", shippingPolicy: "FREE", shippingCost: "" })
    const [savedProfile, setSavedProfile] = useState<SellerProfile | null>(null)// last values loaded from or saved to the server
    const [slug, setSlug] = useState("")
    const [foodOrderType, setFoodOrderType] = useState<FoodOrderType>("NOW")
    const [savedFoodOrderType, setSavedFoodOrderType] = useState<FoodOrderType>("NOW")
    const [sellsFood, setSellsFood] = useState(false)// has a Food & Grocery listing on sale
    const [currentLogoUrl, setCurrentLogoUrl] = useState("")
    const [logoFile, setLogoFile] = useState<File | null>(null)// only filled if the seller picks a new logo
    const [branding, setBranding] = useState<BrandingForm>(EMPTY_BRANDING_FORM)
    const [savedBranding, setSavedBranding] = useState<BrandingForm>(EMPTY_BRANDING_FORM)
    const [bannerUrl, setBannerUrl] = useState<string | null>(null)// the saved banner
    const [bannerFile, setBannerFile] = useState<File | null>(null)// a new banner, uploaded on save
    const [removeBanner, setRemoveBanner] = useState(false)
    const [pickerKey, setPickerKey] = useState(0)// remounts the image pickers to clear unsaved picks
    const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const [error, setError] = useState("")
    const logoPreview = useFileUrl(logoFile)
    const bannerPreview = useFileUrl(bannerFile)

    useEffect(() => {
        const controller = new AbortController()

        async function fetchProfile() {
            try {
                const response = await apiFetch("/seller/profile", { credentials: "include", signal: controller.signal })

                if (controller.signal.aborted) {
                    return
                }

                if (response.status === 404) {// no store profile yet, so the seller still has to onboard
                    navigate("/seller/onboarding", { replace: true })
                    return
                }

                if (!response.ok) {
                    if (response.status !== 401) {// a 401 is handled by the session guard
                        setLoadStatus("error")
                    }
                    return
                }

                const data = await response.json()
                const loadedProfile: SellerProfile = {
                    businessName: data.businessName,
                    state: data.state,
                    lga: data.lga,
                    shippingPolicy: data.shippingPolicy === "FIXED" ? "FIXED" : "FREE",
                    shippingCost: data.shippingCost === null || data.shippingCost === undefined ? "" : String(data.shippingCost)
                }
                // Pre-orders are only for shops with a food listing. A failed check just leaves the setting hidden.
                const listingsResponse = await apiFetch("/listings/Mylisting", { credentials: "include", signal: controller.signal }).catch(() => null)
                const myListings: unknown = listingsResponse?.ok ? await listingsResponse.json().catch(() => null) : null
                if (controller.signal.aborted) {
                    return
                }
                setSellsFood(Array.isArray(myListings) && myListings.some((listing) => listing?.category === "Food & Grocery"))
                const loadedFoodOrderType: FoodOrderType = data.foodOrderType === "PRE_ORDER" || data.foodOrderType === "BOTH" ? data.foodOrderType : "NOW"
                setFormData(loadedProfile)
                setSavedProfile(loadedProfile)
                setSlug(typeof data.slug === "string" ? data.slug : "")
                setFoodOrderType(loadedFoodOrderType)
                setSavedFoodOrderType(loadedFoodOrderType)
                setCurrentLogoUrl(data.logoUrl ?? "")
                const loadedBranding = brandingFormFrom(data.branding)
                setBranding(loadedBranding)
                setSavedBranding(loadedBranding)
                setBannerUrl(data.branding?.bannerUrl ?? null)
                setLoadStatus("ready")
            } catch {
                if (!controller.signal.aborted) {
                    setLoadStatus("error")
                }
            }
        }
        fetchProfile()

        return () => controller.abort()
    }, [navigate, loadAttempt])

    const validationError = validateSellerProfile(formData)

    // The save bar only shows once the profile has loaded and something differs from the saved values.
    const hasChanges =
        savedProfile !== null &&
        (
            logoFile !== null ||
            bannerFile !== null ||
            removeBanner ||
            brandingChanged(branding, savedBranding) ||
            foodOrderType !== savedFoodOrderType ||
            formData.businessName.trim() !== savedProfile.businessName.trim() ||
            formData.state !== savedProfile.state ||
            formData.lga !== savedProfile.lga
        )

    function edit(change: () => void) {
        change()
        setIsSaved(false)
    }

    function discardChanges() {
        if (savedProfile === null) {
            return
        }
        setFormData(savedProfile)
        setBranding(savedBranding)
        setFoodOrderType(savedFoodOrderType)
        setLogoFile(null)
        setBannerFile(null)
        setRemoveBanner(false)
        setPickerKey((key) => key + 1)
        setError("")
    }

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSubmitting || !hasChanges) {
            return
        }

        if (validationError !== null) {
            setError(validationError)
            return
        }

        setIsSubmitting(true)
        setError("")

        try {
            let logoUrl = currentLogoUrl// keeps the old logo unless a new one was picked

            if (logoFile !== null) {
                const uploadedUrl = await uploadImage(logoFile)
                if (uploadedUrl === null) {
                    setError("The logo could not be uploaded. Please check your connection and try again.")
                    return
                }
                logoUrl = uploadedUrl
            }

            let nextBannerUrl = removeBanner ? null : bannerUrl
            if (bannerFile !== null) {
                nextBannerUrl = await uploadImage(bannerFile)
                if (nextBannerUrl === null) {
                    setError("The banner could not be uploaded. Please check your connection and try again.")
                    return
                }
            }

            const response = await apiFetch("/seller/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...buildSellerProfileBody(formData, logoUrl),
                    ...brandingBody(branding, nextBannerUrl),
                    ...(foodOrderType !== savedFoodOrderType ? { foodOrderType } : {})
                }),
                credentials: "include"
            })

            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to save your shop (status ${response.status}).`))
                return
            }

            // Only now are the submitted values the new baseline.
            setSavedProfile(formData)
            setSavedFoodOrderType(foodOrderType)
            setCurrentLogoUrl(logoUrl)
            setLogoFile(null)
            setSavedBranding(branding)
            setBannerUrl(nextBannerUrl)
            setBannerFile(null)
            setRemoveBanner(false)
            setPickerKey((key) => key + 1)
            setIsSaved(true)
            window.scrollTo({ top: 0, behavior: "smooth" })
        } catch {
            setError("Something went wrong. Please check your connection and try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const lead = "Your shop's name, where you are, and how your shop page looks."

    if (loadStatus === "loading") {
        return <SettingsLayout title="Shop details" lead={lead}><p role="status">Loading your shop...</p></SettingsLayout>
    }

    if (loadStatus === "error") {
        return (
            <SettingsLayout title="Shop details" lead={lead}>
                <Notice kind="error">
                    <p>We could not load your shop details. Please check your connection and try again.</p>
                    <button type="button" onClick={() => {
                        setLoadStatus("loading")
                        setLoadAttempt((attempt) => attempt + 1)
                    }}>Try again</button>
                </Notice>
            </SettingsLayout>
        )
    }

    const lgaOptions = formData.state ? lgas(formData.state) ?? [] : []
    const shownBanner = removeBanner ? null : bannerPreview ?? bannerUrl

    return (
        <SettingsLayout title="Shop details" lead={lead}>
            <form className="settings-grid" onSubmit={handleSubmit}>
                <div className="product-form-main">
                    {isSaved && (
                        <Notice kind="success"><p><Check size={16} aria-hidden="true" /> <b>Your shop is saved.</b> Shoppers see the changes straight away.</p></Notice>
                    )}

                    <section className="product-form-card" aria-labelledby="shop-heading">
                        <h2 id="shop-heading">Your shop</h2>
                        <fieldset className="settings-fieldset" disabled={isSubmitting}>
                            <ImagePicker
                                key={pickerKey}
                                label="Logo (optional)"
                                currentUrl={currentLogoUrl || undefined}
                                onChange={(file) => edit(() => setLogoFile(file))}
                                disabled={isSubmitting}
                            />
                            <div className="product-field">
                                <label htmlFor={nameId}>Shop name</label>
                                <input id={nameId} className="product-input" maxLength={SHOP_NAME_MAX_LENGTH} value={formData.businessName} onChange={(event) => edit(() => setFormData({ ...formData, businessName: event.target.value }))} />
                            </div>
                            <div className="product-two">
                                <div className="product-field">
                                    <label htmlFor={stateId}>State</label>
                                    <select id={stateId} className="product-input" value={formData.state} onChange={(event) => edit(() => setFormData({ ...formData, state: event.target.value, lga: "" }))}>
                                        <option value="">Select a state</option>
                                        {states().map((state) => <option key={state} value={state}>{state}</option>)}
                                    </select>
                                </div>
                                <div className="product-field">
                                    <label htmlFor={lgaId}>Local government area</label>
                                    <select id={lgaId} className="product-input" value={formData.lga} disabled={!formData.state} onChange={(event) => edit(() => setFormData({ ...formData, lga: event.target.value }))}>
                                        <option value="">{formData.state ? "Select a local government area" : "Select a state first"}</option>
                                        {lgaOptions.map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                                    </select>
                                </div>
                            </div>
                            <p className="product-help">Where you send orders from. Delivery fees are set on the <Link to="/seller/delivery">Delivery</Link> page.</p>
                        </fieldset>
                    </section>

                    <ShopLookFields
                        form={branding}
                        setForm={(next) => edit(() => setBranding(next))}
                        bannerUrl={removeBanner ? null : bannerUrl}
                        onBannerFile={(file) => edit(() => { setBannerFile(file); if (file) setRemoveBanner(false) })}
                        onRemoveBanner={() => edit(() => { setRemoveBanner(true); setBannerFile(null) })}
                        disabled={isSubmitting}
                        pickerKey={pickerKey}
                    />

                    <ShopLinksFields form={branding} setForm={(next) => edit(() => setBranding(next))} disabled={isSubmitting} />

                    {(sellsFood || savedFoodOrderType !== "NOW") && (
                        <section className="product-form-card" aria-labelledby="food-heading">
                            <h2 id="food-heading">How your food is sold</h2>
                            <p className="product-help settings-card-lead">You see this because you sell food. It's set once for the whole shop.</p>
                            <fieldset className="settings-choices" disabled={isSubmitting}>
                                <legend className="visually-hidden">How your food is sold</legend>
                                {FOOD_CHOICES.map((choice) => (
                                    <label key={choice.value} className={`settings-choice${foodOrderType === choice.value ? " is-on" : ""}`}>
                                        <input type="radio" name={foodName} checked={foodOrderType === choice.value} onChange={() => edit(() => setFoodOrderType(choice.value))} />
                                        <span><b>{choice.title}</b><span>{choice.text}</span></span>
                                    </label>
                                ))}
                            </fieldset>
                            <p className="product-help">
                                With pre-orders, buyers ask for a ready time and you have 48 hours to approve or decline before they pay. "Pre-orders only" applies to everything you sell, not just food.
                            </p>
                        </section>
                    )}

                    {error && <Notice kind="error">{error}</Notice>}

                    {hasChanges && (
                        <div className="settings-savebar" role="region" aria-label="Unsaved changes">
                            <p>{validationError ?? "You have unsaved changes"}</p>
                            <button type="button" className="btn" onClick={discardChanges} disabled={isSubmitting}>Discard</button>
                            <button type="submit" className="btn btn-primary" disabled={validationError !== null || isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save changes"}
                            </button>
                        </div>
                    )}
                </div>

                <ShopPreview profile={formData} branding={branding} logoUrl={logoPreview ?? (currentLogoUrl || null)} bannerUrl={shownBanner} slug={slug} />
            </form>
        </SettingsLayout>
    )
}

export default EditSellerProfilePage
